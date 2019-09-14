(function() {
  "use strict";

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

  document.addEventListener('DOMContentLoaded', function() {
    var INPUTS = document.querySelectorAll('input'),
        btn = document.getElementById('download'),
        num = document.getElementById('num');

    function get_data() {
      return Array.prototype.reduce.call(INPUTS, function(r, el) {
        r[el.id] = el.value;
        return r;
      }, {});
    }

    var timeout = null;

    function refresh() {
      if (timeout !== null) {
        // clear existing timeout
        clearTimeout(timeout);
      }

      // set new timeout
      timeout = setTimeout(function() {
        // reset output
        num.innerHTML = '0';

        // get input parameters
        var data = get_data();

        // check inputs
        if (!data.min || !data.max || !data.freq) {
          return;
        }

        // make time range
        var times = Times.make(data.date, data.min, data.max, data.freq);

        // refresh meeting count
        num.innerHTML = times.length;

        // set calendar download button
        btn.download = data.summary + '.ics';
        btn.href = 'data:text/calendar;base64,' + btoa(ICS.make(data, times));
      }, 100);
    }

    // add event listeners
    Array.prototype.forEach.call(INPUTS, function(el) {
      el.addEventListener('change', refresh, false);
      el.addEventListener('keydown', refresh, false);
    });

    // focus summary
    var today = (new Date()).toISOString().replace(/T.*$/, '');
    document.getElementById('date').value = today;
    document.getElementById('summary').focus();
  }, false);
})();
