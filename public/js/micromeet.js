(function() {
  "use strict";

  // micromeet namespace
  var MM = {
    /**
     * event list namespace
     */
    Events: (function() {
      var TZ_OFS = (new Date()).getTimezoneOffset();

      function make_date(date, time) {
        var r = new Date(date + 'T' + time + ':00');
        return r;
      }

      function step(date, freq) {
        var r = new Date(date.getTime() + (+freq * 1000));
        return r;
      }

      function summarize(summary, num, max) {
        return summary + ' (' + num + '/' + max + ')';
      }

      function make(data) {
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
          row.summary = summarize(data.summary, (i + 1), r.length);
          row.description = summarize(data.description, (i + 1), r.length);
          return row;
        });
      }

      // expose public interface
      return {
        make: make,
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
        var HEADER = [
          'start time',
          'end time',
          'summary',
          'description',
          'organizer name',
          'organizer email',
        ];

        function quote(s) {
          return '"' + (s || '').replace(/"/g, '""') + '"';
        }

        function add_event(rows, data, ev) {
          rows.push([
            ev.min,
            ev.max,
            quote(ev.summary),
            quote(ev.description),
            quote(data.name),
            quote(data.email),
          ].join(','));
        }

        function make(data, evs) {
          // header
          var rows = [].concat(HEADER.join(','));

          // append events
          for (var i = 0; i < evs.length; i++) {
            add_event(rows, data, evs[i]);
          }

          // build/return result
          return rows.join("\n");
        }

        return {
          make: make,
        };
      })(),

      /**
       * ics renderer
       */
      ICS: (function() {
        var HEADER = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//pmdn/micromeet//NONSGML v1.0//EN',
        ];

        var FOOTER = [
          'END:VCALENDAR',
        ];

        function make_time(d) {
          // convert to short iso8601 date format
          return d.toISOString().replace(/:|-|\.\d{3}/g, '');
        }

        function add_event(rows, data, ev) {
          rows.push(
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
          );
        }

        function make(data, evs) {
          // header
          var rows = [].concat(HEADER);

          // append events
          for (var i = 0; i < evs.length; i++) {
            add_event(rows, data, evs[i]);
          }

          // append footer
          rows = rows.concat(FOOTER);

          // build/return result
          return rows.join("\n");
        }

        return {
          make: make,
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
     * used to build map of keys to node lists.
     */
    ELS: [{
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
  };

  // cached data (used by download button click handlers)
  var CACHE = {};

  document.addEventListener('DOMContentLoaded', function() {
    // build element map
    var ELS = MM.ELS.reduce(function(r, row) {
      r[row.id] = document.querySelectorAll(row.css);
      return r;
    }, { fields: document.querySelectorAll('input, select') });

    // enable/disable download buttons
    function set_btns(enabled) {
      // disable download buttons
      MM.each(ELS.btns, function(el) {
        if (enabled) {
          el.classList.remove('disabled');
          el.disabled = false;
        } else {
          el.classList.add('disabled');
          el.disabled = true;
        }
      });
    }

    // reset state
    function reset() {
      // reset output
      MM.each(ELS.num, function(el) {
        el.innerHTML = '0';
      });

      // disable buttons
      set_btns(false);
    }

    // refresh handler (called by input change/keydown handlers)
    var refresh = MM.delay(100, function() {
      // reset output
      reset();

      // get input data and validate it
      var data = MM.get_data(ELS.fields);
      if (!MM.is_valid(data)) {
        return;
      }

      // enable download buttons
      set_btns(true);

      // cache data, build array of events
      CACHE.data = data;
      CACHE.evs = MM.Events.make(data);

      // refresh meeting count
      MM.each(ELS.num, function(el) {
        el.innerHTML = CACHE.evs.length;
      });

      // set ics btn download names
      MM.each(ELS.ics, function(el) {
        el.download = data.summary + '.ics';
      });

      // set csv btn download names
      MM.each(ELS.csv, function(el) {
        el.download = data.summary + '.csv';
      });
    });

    // add event handlers to all fields
    MM.each(ELS.fields, function(el) {
      el.addEventListener('change', refresh, false);
      el.addEventListener('keydown', refresh, false);
    });

    // add ics btn event handlers
    MM.each(ELS.ics, function(el) {
      el.addEventListener('click', function() {
        // set calendar download button
        var ics = btoa(MM.Views.ICS.make(CACHE.data, CACHE.evs));
        el.href = 'data:text/calendar;base64,' + ics;
      });
    });

    // add csv btn event handlers
    MM.each(ELS.csv, function(el) {
      el.addEventListener('click', function() {
        var csv = btoa(MM.Views.CSV.make(CACHE.data, CACHE.evs));
        el.href = 'data:text/csv;base64,' + csv;
      });
    });

    // add view button event handlers
    MM.each(ELS.view, function(el) {
      el.addEventListener('click', function() {
        alert("Eventually this button will show your micromeetings, but it's not done yet. Stay tuned!");
        return false;
      });
    });

    // focus summary
    var today = (new Date()).toISOString().replace(/T.*$/, '');
    document.getElementById('date').value = today;
    document.getElementById('summary').focus();

    // trigger initial refresh
    refresh();
  }, false);
})();
