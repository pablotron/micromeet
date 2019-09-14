(function() {
  "use strict";

  var Times = (function() {
    function make_date(date, time) {
      var r = new Date(date + 'T' + time + ':00Z');
      return r;
    }

    function step(date, freq) {
      var r = new Date(date.getTime() + (+freq * 1000));
      return r;
    }

    function make(date, time_min, time_max, freq) {
      var r = [],
          min = make_date(date, time_min),
          max = make_date(date, time_max);

      for (var t = min; t < max; t = step(t, freq)) {
        r.push({ min: t, max: step(t, +freq - 1) });
      }

      return r;
    }

    return {
      make: make,
    };
  })();

  var ICS = (function() {
    function make_time(d) {
      return d.toISOString().replace(/[:-]/g, '');
    }

    function summarize(summary, num, max) {
      return summary + ' (' + num + '/' + max + ')';
    }

    function make(r, times) {
      // header
      var rows = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//hacksw/handcal//NONSGML v1.0//EN',
      ];

      // append events
      for (var i = 0; i < times.length; i++) {
        var t = times[i];

        rows.push(
          'BEGIN:VEVENT',
          'UID:uid1@example.com',
          'ORGANIZER;CN=' + r.name + ':MAILTO:' + r.email,
          'DTSTART:' + make_time(t.min),
          'DTEND:' + make_time(t.max),
          'SUMMARY:' + summarize(r.summary, (i + 1), times.length),
          'END:VEVENT'
        );
      }

      // append footer
      rows.push('END:VCALENDAR');

      // build/return result
      return rows.join("\n");
    }

    return {
      make: make,
    };
  })();

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
        ELS = ['num', 'ics', 'csv', 'freq'].reduce(function(r, id) {
          r[id] = document.getElementById(id);
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
      ELS.num.innerHTML = '0';

      // get input parameters
      var data = get_data();

      // check inputs
      if (!data.min || !data.max || !data.freq) {
        return;
      }

      // make time range
      var times = Times.make(data.date, data.min, data.max, data.freq);

      // refresh meeting length and meeting count
      ELS.num.innerHTML = times.length;

      // set calendar download button
      var ics = ICS.make(data, times);
      ELS.ics.download = data.summary + '.ics';
      ELS.ics.href = 'data:text/calendar;base64,' + btoa(ics);
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

    refresh();
  }, false);
})();
