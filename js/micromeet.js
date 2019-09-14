(function() {
  "use strict";

  var Times = (function() {
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

    return {
      make: make,
    };
  })();

  var Views = {
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

      function make(data, times) {
        // header
        var rows = [].concat(HEADER.join(','));

        // append events
        for (var i = 0; i < times.length; i++) {
          add_event(rows, data, times[i]);
        }

        // build/return result
        return rows.join("\n");
      }

      return {
        make: make,
      };
    })(),

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

      function make(data, times) {
        // header
        var rows = [].concat(HEADER);

        // append events
        for (var i = 0; i < times.length; i++) {
          add_event(rows, data, times[i]);
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
  };

  /**
   * delay: Return a function that is delayed for the given number of
   * milliseconds.
   *
   * Note: the timeout will reset if the function is called within the
   * delay interval.
   */
  function delay(time, fn) {
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
  }

  document.addEventListener('DOMContentLoaded', function() {
    var INPUTS = document.querySelectorAll('input, select'),
        ELS = [{
          id:   'num',
          css:  '.num-meetings',
        }, {
          id:   'ics',
          css:  '.download-btn[data-type="ics"]',
        }, {
          id:   'csv',
          css:  '.download-btn[data-type="csv"]',
        }].reduce(function(r, row) {
          r[row.id] = document.querySelectorAll(row.css);
          return r;
        }, {});

    function get_data() {
      return Array.prototype.reduce.call(INPUTS, function(r, el) {
        r[el.id] = el.value;
        return r;
      }, {});
    }

    var refresh = delay(100, function() {
      // reset output
      Array.prototype.forEach.call(ELS.num, function(el) {
        el.innerHTML = '0';
      });

      // get input parameters
      var data = get_data();

      // check inputs
      if (!data.min || !data.max || !data.freq) {
        return;
      }

      // make time range
      var times = Times.make(data);

      // refresh meeting length and meeting count
      Array.prototype.forEach.call(ELS.num, function(el) {
        el.innerHTML = times.length;
      });

      // set calendar download button
      var ics = btoa(Views.ICS.make(data, times));
      Array.prototype.forEach.call(ELS.ics, function(el) {
        el.download = data.summary + '.ics';
        el.href = 'data:text/calendar;base64,' + ics;
      });

      var csv = btoa(Views.CSV.make(data, times));
      Array.prototype.forEach.call(ELS.csv, function(el) {
        el.download = data.summary + '.csv';
        el.href = 'data:text/csv;base64,' + csv;
      });
    });

    // add event listeners
    Array.prototype.forEach.call(INPUTS, function(el) {
      el.addEventListener('change', refresh, false);
      el.addEventListener('keydown', refresh, false);
    });

    // focus summary
    var today = (new Date()).toISOString().replace(/T.*$/, '');
    document.getElementById('date').value = today;
    document.getElementById('summary').focus();

    // trigger initial refresh
    refresh();
  }, false);
})();
