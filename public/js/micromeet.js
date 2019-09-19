(function() {
  "use strict";

  // micromeet namespace
  var MM = {
    /**
     * event list namespace
     */
    Events: (function() {
      function make_date(date, time) {
        var r = new Date(date + 'T' + time + ':00');
        return r;
      }

      function step(date, freq) {
        var r = new Date(date.getTime() + (+freq * 1000));
        return r;
      }

      function title(summary, num, max) {
        return summary + ' (' + num + '/' + max + ')';
      }

      // expose public interface
      return {
        make: function(data) {
          var r = [],
              min = make_date(data.date, data.min),
              max = make_date(data.date, data.max);

          for (var t = min; t < max; t = step(t, data.freq)) {
            r.push({
              min: t,
              max: step(t, +data.freq - 1)
            });
          }

          return r.map(function(row, i) {
            row.summary = title(data.summary, (i + 1), r.length);
            row.description = title(data.description, (i + 1), r.length);
            return row;
          });
        },
      };
    })(),

    /**
     * rendering view namespace
     */
    Views: {
      /**
       * csv renderer
       */
      CSV: (function() {
        function quote(s) {
          return '"' + (s || '').replace(/"/g, '""') + '"';
        }

        return {
          make: function(data, evs) {
            var name = quote(data.name),
                email = quote(data.email);

            return [[
              'start',
              'end',
              'summary',
              'description',
              'organizer name',
              'organizer email',
            ].join(',')].concat(evs.map(function(ev) {
              return [
                ev.min,
                ev.max,
                quote(ev.summary),
                quote(ev.description),
                name,
                email,
              ].join(',');
            })).join("\n");
          },
        };
      })(),

      /**
       * ics renderer
       */
      ICS: (function() {
        function make_time(d) {
          // convert to short iso8601 date format
          return d.toISOString().replace(/:|-|\.\d{3}/g, '');
        }

        return {
          make: function(data, evs) {
            return [
              'BEGIN:VCALENDAR',
              'VERSION:2.0',
              'PRODID:-//pmdn/micromeet//NONSGML v1.0//EN',
            ].concat(evs.map(function(ev) {
              return [
                'BEGIN:VEVENT',
                'UID:uid-' + make_time(ev.min) + '@micromeet.pmdn.org',
                'ORGANIZER;CN=' + data.name + ':MAILTO:' + data.email,
                'ORGANIZER;CN=' + data.name + ':MAILTO:' + data.email,
                'DTSTART:' + make_time(ev.min),
                'DTEND:' + make_time(ev.max),
                'SUMMARY:' + ev.summary,
                'DESCRIPTION:' + ev.description,
                'SEQUENCE:1',
                'END:VEVENT'
              ].join("\n");
            })).concat([
              'END:VCALENDAR',
            ]).join("\n");
          },
        };
      })(),

      /**
       * html renderer
       */
      HTML: (function() {
        function t(d) {
          return [
            d.getHours(),
            d.getMinutes(),
            d.getSeconds(),
          ].map(function(n) {
            return (n < 10) ? ('0' + n) : n;
          }).join(':');
        }

        function h(s) {
          return ('' + (s || '')).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        return {
          make: function(data, evs) {
            return evs.map(function(ev) {
              return '<tr>' + ([
                t(ev.min),
                t(ev.max),
                ev.summary,
                ev.description,
              ].map(function(v) {
                return '<td>' + h(v) + '</td>';
              })).join('') + '</tr>';
            }).join('');
          },
        };
      })(),

    },

    /**
     * delay: Return a function that is delayed for the given number of
     * milliseconds.
     *
     * Note: the timeout will reset if the function is called within the
     * delay interval.
     */
    delay: function(time, fn) {
      var timeout = null;

      return function() {
        if (timeout !== null) {
          // clear existing timeout
          clearTimeout(timeout);
        }

        // set new timeout
        timeout = setTimeout(function() {
          fn();
        }, time);
      };
    },

    /**
     * iterate over list (potentially a NodeList).
     */
    each: function(list, fn) {
      Array.prototype.forEach.call(list, fn);
    },

    /**
     * build hash of parameters from elements.
     */
    get_data: function(els) {
      return Array.prototype.reduce.call(els, function(r, el) {
        r[el.id] = el.value;
        return r;
      }, {});
    },

    /**
     * check for required inputs.
     */
    is_valid: function(data) {
      return (data.min && data.max && data.freq);
    },

    /**
     * add event handler.
     */
    on: function(el, ev, fn, b) {
      return el.addEventListener(ev, fn, b || false);
    },

    /**
     * set href of element to base64-encoded data of given type.
     */
    b64: function(el, type, data) {
      el.href = 'data:text/' + type + ';base64,' + btoa(data);
    },

    /**
     * used to build map of keys to node lists.
     */
    E: [{
      id:   'num',
      css:  '.num-meetings',
    }, {
      id:   'btns',
      css:  '.download-btn, .view-btn',
    }, {
      id:   'view',
      css:  '.view-btn',
    }, {
      id:   'ics',
      css:  '.download-btn[data-type="ics"]',
    }, {
      id:   'csv',
      css:  '.download-btn[data-type="csv"]',
    }],

    DLS: [{
      ext:  'ics',
      type: 'calendar',
      view: 'ICS',
    }, {
      ext:  'csv',
      type: 'csv',
      view: 'CSV'
    }],
  };

  // cached data (used by download button click handlers)
  var D = document, C = {};

  MM.on(D, 'DOMContentLoaded', function() {
    // build element map
    var E = MM.E.reduce(function(r, row) {
      r[row.id] = D.querySelectorAll(row.css);
      return r;
    }, { fields: D.querySelectorAll('input, select') });

    // enable/disable download buttons
    function set_btns(enabled) {
      // toggle buttons
      MM.each(E.btns, function(el) {
        el.disabled = !enabled;
        if (enabled) {
          el.classList.remove('disabled');
        } else {
          el.classList.add('disabled');
        }
      });
    }

    // reset state
    function reset() {
      // reset output
      MM.each(E.num, function(el) {
        el.innerHTML = '0';
      });

      // disable buttons
      set_btns(false);
    }

    /**
     * render and return given view.
     */
    function view(id) {
      return MM.Views[id].make(C.data, C.evs);
    }

    // refresh handler (called by input change/keydown handlers)
    var refresh = MM.delay(100, function() {
      // reset output
      reset();

      // get input data and validate it
      var data = MM.get_data(E.fields);
      if (!MM.is_valid(data)) {
        return;
      }

      // enable download buttons
      set_btns(true);

      // cache data, build array of events
      C.data = data;
      C.evs = MM.Events.make(data);

      // refresh meeting count
      MM.each(E.num, function(el) {
        el.innerHTML = C.evs.length;
      });

      // set download names
      MM.each(MM.DLS, function(dl) {
        MM.each(E[dl.ext], function(el) {
          el.download = data.summary + '.' + dl.ext;
        });
      });
    });

    // add event handlers to all fields
    MM.each(E.fields, function(el) {
      MM.on(el, 'change', refresh);
      MM.on(el, 'keydown', refresh);
    });

    // add download button click handlers
    MM.each(MM.DLS, function(dl) {
      MM.each(E[dl.ext], function(el) {
        MM.on(el, 'click', function() {
          MM.b64(el, dl.type, view(dl.view));
        });
      });
    });

    // add view dialog event handlers
    $('#view-dialog').on('show.bs.modal', function() {
      // render html
      $('#view-rows').html(view('HTML'));
    });

    // set to current date
    var today = (new Date()).toISOString().replace(/T.*$/, '');
    D.getElementById('date').value = today;

    // focus summary
    D.getElementById('summary').focus();

    // trigger initial refresh
    refresh();
  });
})();
