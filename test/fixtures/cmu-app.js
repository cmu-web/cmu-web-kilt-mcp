/* Carnegie Mellon Web Kilt: behaviors for the kit's components. Load it after
   the template's scripts, at the end of <body>. Each behavior hooks onto a
   data-cmu-* attribute and works on markup added later too. */
(function () {
  "use strict";

  // Copy button: <button class="btn" type="button" data-cmu-copy="#id">.
  // Copies the target's text, says "Copied" on the button for two seconds
  // and tells screen readers. Without the clipboard (an http page, an old
  // browser) it selects the text and asks for the keyboard instead. The icon
  // version (button.cmu-copy, named by aria-label and title) shows a check
  // and puts the message in its label and tooltip instead.
  var status;
  function announce(text) {
    if (!status) {
      status = document.createElement("p");
      status.className = "sr-only";
      status.setAttribute("aria-live", "polite");
      document.body.appendChild(status);
    }
    status.textContent = "";
    setTimeout(function () {
      status.textContent = text;
    }, 50);
  }
  function selectText(el) {
    if (el.select) return el.select();
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function flash(button, label, state) {
    var icon = button.classList.contains("cmu-copy");
    if (!button.hasAttribute("data-cmu-copy-label"))
      button.setAttribute(
        "data-cmu-copy-label",
        icon ? button.getAttribute("aria-label") || "" : button.textContent,
      );
    var original = button.getAttribute("data-cmu-copy-label");
    if (icon) {
      button.setAttribute("data-cmu-copy-state", state);
      button.setAttribute("aria-label", label);
      button.title = label;
    } else {
      button.textContent = label;
    }
    clearTimeout(button.cmuCopyTimer);
    button.cmuCopyTimer = setTimeout(function () {
      if (icon) {
        button.removeAttribute("data-cmu-copy-state");
        button.setAttribute("aria-label", original);
        button.title = original;
      } else {
        button.textContent = original;
      }
    }, 2000);
  }
  document.addEventListener("click", function (e) {
    var button = e.target.closest && e.target.closest("[data-cmu-copy]");
    if (!button) return;
    var target = document.querySelector(button.getAttribute("data-cmu-copy"));
    if (!target) return;
    var text = "value" in target ? target.value : target.textContent;
    var fallback = function () {
      selectText(target);
      var keys = /Mac|iPhone|iPad/.test(navigator.platform) ? "Command-C" : "Control-C";
      flash(button, "Press " + keys, "keys");
      announce("Selected. Press " + keys + " to copy.");
    };
    if (!navigator.clipboard || !window.isSecureContext) return fallback();
    navigator.clipboard.writeText(text).then(function () {
      flash(button, "Copied", "copied");
      announce("Copied.");
    }, fallback);
  });

  // In-page links: the template's script turns href="#id" into
  // javascript:void(0) (keeping the target in data-jump) and scrolls with its
  // own animation, so the address never shows the section and Back doesn't
  // return. Put the real links back once it has run, and add the section to
  // the address as the template scrolls to it.
  function restoreJumps() {
    document.querySelectorAll("a[data-jump]").forEach(function (a) {
      var target = a.getAttribute("data-jump");
      if (target.length > 1 && /^javascript:/.test(a.getAttribute("href")))
        a.setAttribute("href", target);
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(restoreJumps);
    });
  else setTimeout(restoreJumps);
  document.addEventListener(
    "click",
    function (e) {
      var a = e.target.closest && e.target.closest("a[data-jump]");
      if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var target = a.getAttribute("data-jump");
      if (target.length < 2) return;
      e.preventDefault(); // the template does the scrolling
      if (location.hash !== target) history.pushState(null, "", target);
    },
    true,
  );

  // Enlarge on click: <a href="big.jpg" data-cmu-zoom><img alt="..."></a> opens
  // the image over the page, with the page dimmed behind it; Escape, the close
  // button or a click anywhere closes it, and focus goes back to the link. An
  // image much taller than the window opens at full width and scrolls.
  // Without the script (or a browser without <dialog>), the link opens the image.
  // See Enlarge on Click in the docs (content.html).
  var zoom, zoomOpener, zoomByPointer;
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-cmu-zoom]");
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!window.HTMLDialogElement) return;
    e.preventDefault();
    if (!zoom || !zoom.isConnected) {
      zoom = document.createElement("dialog");
      zoom.className = "cmu-zoom";
      zoom.innerHTML =
        '<button type="button" class="cmu-zoom-close" aria-label="Close">&times;</button>' +
        '<div class="cmu-zoom-frame"><img alt=""></div>';
      zoom.addEventListener("click", function (ev) {
        // A click or tap, not Enter on the close button
        zoomByPointer = ev.detail > 0;
        zoom.close();
      });
      // Focus goes back to the link. Closed with the mouse, it goes back
      // without a focus ring (Firefox would draw one); with the keyboard, the
      // ring stays to show where focus is
      zoom.addEventListener("close", function () {
        if (zoomByPointer && zoomOpener && zoomOpener.isConnected) {
          zoomOpener.blur();
          zoomOpener.focus({ preventScroll: true, focusVisible: false });
        }
        zoomByPointer = false;
      });
      document.body.appendChild(zoom);
    }
    zoomOpener = a;
    var small = a.querySelector("img"),
      big = zoom.querySelector("img"),
      frame = zoom.querySelector(".cmu-zoom-frame");
    // Tall: at the widest it can show, the image is over a quarter taller
    // than the window, so fitting it whole would shrink it too far
    function fit() {
      var w = Math.min(big.naturalWidth, window.innerWidth * 0.92, 1400),
        tall =
          big.naturalWidth > 0 &&
          (big.naturalHeight * w) / big.naturalWidth > window.innerHeight * 0.92 * 1.25;
      zoom.classList.toggle("cmu-zoom--tall", tall);
      if (tall) frame.tabIndex = 0;
      else frame.removeAttribute("tabindex");
      frame.scrollTop = 0;
    }
    big.onload = fit;
    big.src = a.href;
    big.alt = small ? small.alt : "";
    if (big.complete) fit();
    zoom.showModal();
  });

  // Countdown: <div class="cmu-countdown" data-cmu-countdown="2027-04-08T12:00:00-04:00">
  // with a sentence inside that gives the same moment. Shows days, hours,
  // minutes and seconds on flip cards and stops at zero; screen readers get
  // the sentence instead of the ticking cards. An optional
  // <div class="cmu-countdown-done" hidden> inside shows once it reaches zero,
  // when the countdown also gets cmu-countdown-ended; with
  // cmu-countdown--replace, the cards then go. See Countdown in the docs
  // (content.html). Adapted from a CodePen by Shaw
  // (codepen.io/shshaw/pen/vKzoLL, MIT).
  var UNITS = [
    ["Days", 864e5, Infinity],
    ["Hours", 36e5, 24],
    ["Minutes", 6e4, 60],
    ["Seconds", 1e3, 60],
  ];
  function card(unit) {
    var el = document.createElement("div");
    el.className = "cmu-countdown-unit";
    el.innerHTML =
      '<b class="cmu-countdown-card"><b class="cmu-countdown-top"></b>' +
      '<b class="cmu-countdown-bottom"></b><b class="cmu-countdown-back">' +
      '<b class="cmu-countdown-bottom"></b></b></b>' +
      '<span class="cmu-countdown-label">' +
      unit +
      "</span>";
    return el;
  }
  function flip(el, value) {
    if (el.cmuValue === value) return;
    var top = el.querySelector(".cmu-countdown-top");
    var bottom = el.querySelector(".cmu-countdown-bottom");
    var back = el.querySelector(".cmu-countdown-back");
    // The bottom half shows the old value until the new one flips down over
    // it; the first time there's no old value, so it starts with the new one
    var old = el.cmuValue === undefined ? value : el.cmuValue;
    back.setAttribute("data-value", old);
    bottom.setAttribute("data-value", old);
    el.cmuValue = value;
    top.textContent = value;
    back.querySelector(".cmu-countdown-bottom").setAttribute("data-value", value);
    el.classList.remove("cmu-countdown-flip");
    void el.offsetWidth; // restart the animation
    el.classList.add("cmu-countdown-flip");
    // Once the flip is done, the front catches up, so a narrower old value
    // (02 before 155) doesn't show at the edge
    clearTimeout(el.cmuSync);
    el.cmuSync = setTimeout(function () {
      back.setAttribute("data-value", value);
      bottom.setAttribute("data-value", value);
    }, 650);
  }
  function countdown(root) {
    var end = new Date(root.getAttribute("data-cmu-countdown"));
    if (isNaN(end)) return;
    clearInterval(root.cmuCountdown);
    var clock = root.querySelector(".cmu-countdown-clock");
    if (!clock) {
      clock = document.createElement("div");
      clock.className = "cmu-countdown-clock";
      clock.setAttribute("aria-hidden", "true");
      UNITS.forEach(function (u) {
        clock.appendChild(card(u[0]));
      });
      // Before the done message, if there is one, so it shows under the cards
      root.insertBefore(clock, root.querySelector(":scope > .cmu-countdown-done"));
      root.classList.add("cmu-countdown-on");
    }
    var units = clock.children,
      done = root.querySelector(":scope > .cmu-countdown-done");
    function tick() {
      var left = Math.max(end - new Date(), 0);
      UNITS.forEach(function (u, i) {
        var n = Math.floor(left / u[1]);
        if (u[2] !== Infinity) n %= u[2];
        flip(units[i], String(n).padStart(2, "0"));
      });
      if (done) done.hidden = left > 0;
      root.classList.toggle("cmu-countdown-ended", !left);
      if (!left) clearInterval(root.cmuCountdown);
    }
    root.cmuCountdown = setInterval(tick, 1000);
    tick();
  }
  function startCountdowns(scope) {
    if (scope.querySelectorAll) scope.querySelectorAll("[data-cmu-countdown]").forEach(countdown);
    if (scope.matches && scope.matches("[data-cmu-countdown]")) countdown(scope);
  }
  // Email links: <a data-cmu-email="ac00(through)andrew.cmu.edu">Email Andrew
  // Carnegie</a>. The address isn't in the page's HTML, and the link isn't
  // built until someone points at it, focuses it or taps it, so scrapers that
  // only read or load the page don't find it. Until then it's announced and
  // focusable as a link. The link keeps its own words. See Email Links in the
  // docs (content.html).
  function emailReady(a) {
    if (a.hasAttribute("href")) return;
    a.setAttribute("role", "link");
    a.tabIndex = 0;
  }
  function emailOpen(a) {
    if (a.hasAttribute("href")) return;
    a.href = "mailto:" + a.getAttribute("data-cmu-email").replace("(through)", "@");
    a.removeAttribute("role");
    a.removeAttribute("tabindex");
  }
  function startEmails(scope) {
    if (scope.querySelectorAll) scope.querySelectorAll("a[data-cmu-email]").forEach(emailReady);
    if (scope.matches && scope.matches("a[data-cmu-email]")) emailReady(scope);
  }
  startEmails(document);
  ["mouseover", "focusin", "pointerdown", "touchstart"].forEach(function (type) {
    document.addEventListener(
      type,
      function (e) {
        var a = e.target.closest && e.target.closest("a[data-cmu-email]");
        if (a) emailOpen(a);
      },
      { passive: true },
    );
  });
  // Enter on the focused link: build it (if focus didn't already) and follow it
  document.addEventListener("keydown", function (e) {
    var a = e.key === "Enter" && e.target.closest && e.target.closest("a[data-cmu-email]");
    if (a && !a.hasAttribute("href")) {
      emailOpen(a);
      a.click();
    }
  });

  // Sorting: <ol class="cmu-sort" data-cmu-sort> whose items people put in
  // order. Adds up and down arrow buttons to each item (named for the item, for
  // screen readers), keeps focus on the moved item and says where it went. A
  // hidden input in each item moves with it, so a form sends the new order.
  // Without the script the list keeps its first order. See Sorting in the
  // docs (forms.html).
  function sortable(list) {
    if (list.cmuSort) return;
    list.cmuSort = true;
    list.querySelectorAll(":scope > li").forEach(function (li) {
      li.cmuName = li.textContent.trim().replace(/\s+/g, " ");
      var moves = document.createElement("span");
      moves.className = "cmu-sort-moves";
      // Arrows, like the sortable table headers; the label names the item
      [
        ["-1", "up", "\u25B2"],
        ["1", "down", "\u25BC"],
      ].forEach(function (m) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn ghost small";
        b.setAttribute("data-cmu-move", m[0]);
        b.setAttribute("aria-label", "Move " + li.cmuName + " " + m[1]);
        b.title = "Move " + m[1];
        b.textContent = m[2];
        moves.appendChild(b);
      });
      li.appendChild(moves);
    });
    sortEnds(list);
  }
  // The first item can't go up, and the last can't go down
  function sortEnds(list) {
    var items = list.querySelectorAll(":scope > li");
    items.forEach(function (li, i) {
      li.querySelector('[data-cmu-move="-1"]').disabled = i === 0;
      li.querySelector('[data-cmu-move="1"]').disabled = i === items.length - 1;
    });
  }
  function startSorts(scope) {
    if (scope.querySelectorAll) scope.querySelectorAll("[data-cmu-sort]").forEach(sortable);
    if (scope.matches && scope.matches("[data-cmu-sort]")) sortable(scope);
  }
  startSorts(document);
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-cmu-sort] [data-cmu-move]");
    if (!b) return;
    var li = b.closest("li"),
      list = li.parentElement,
      dir = Number(b.getAttribute("data-cmu-move")),
      other = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
    if (!other) return;
    list.insertBefore(dir < 0 ? li : other, dir < 0 ? other : li);
    sortEnds(list);
    // At the top or bottom now, focus the other button
    (b.disabled ? li.querySelector('[data-cmu-move="' + -dir + '"]') : b).focus();
    var at = Array.prototype.indexOf.call(list.children, li) + 1;
    announce(li.cmuName + ", " + at + " of " + list.children.length);
  });

  // Row menu: <div class="cmu-row-menu"> holds a <button class="btn small
  // ghost" data-cmu-menu aria-controls="list-id" aria-expanded="false"
  // aria-label="More actions for ..."> and the list, <div
  // class="cmu-row-menu-list" id="list-id" hidden>, of the row's other
  // actions. The button opens the list under it, one at a time; a click
  // elsewhere or Escape closes it. See Tables With Actions in the docs
  // (lists.html).
  function closeMenus(except) {
    document.querySelectorAll('[data-cmu-menu][aria-expanded="true"]').forEach(function (b) {
      if (b === except) return;
      b.setAttribute("aria-expanded", "false");
      var list = document.getElementById(b.getAttribute("aria-controls"));
      if (list) list.hidden = true;
    });
  }
  document.addEventListener("click", function (e) {
    var toggle = e.target.closest && e.target.closest("[data-cmu-menu]");
    if (toggle) {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      closeMenus(toggle);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      var list = document.getElementById(toggle.getAttribute("aria-controls"));
      if (list) list.hidden = !open;
      return;
    }
    if (!(e.target.closest && e.target.closest(".cmu-row-menu-list"))) closeMenus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = document.querySelector('[data-cmu-menu][aria-expanded="true"]');
    if (open) {
      closeMenus();
      open.focus();
    }
  });

  // ID tap: <div class="cmu-tap-target"> holds a label and a hidden <input
  // data-cmu-tap>, where an NFC card reader types an ID card's number and a
  // carriage return (Enter). When it's the only tap on the page, the field
  // takes focus when the page loads, so the reader is listening without a click;
  // selecting the target focuses it again, and so does sending its form,
  // ready for the next card. With data-cmu-tap="keep",
  // on a page that's only for tapping, it also takes focus whenever nothing
  // else has it. With data-cmu-tap="click", it waits to be selected, for a
  // page where something else should have focus first. See ID Tap in the docs
  // (forms.html).
  function focusTap(field) {
    if (field) field.focus({ preventScroll: true });
  }
  // Nothing has focus, or only the template's menu does, which it takes by
  // itself when it opens on a wide screen
  function idle() {
    var active = document.activeElement;
    return !active || active === document.body || active.id === "nav";
  }
  function keepTap() {
    var field = document.querySelector('[data-cmu-tap="keep"]');
    if (field && idle()) focusTap(field);
  }
  // The only tap on the page starts ready; with several, each waits to be
  // selected, since a reader can only type into one
  function startTap() {
    // A tap in a dialog doesn't count unless the dialog is open as one: it
    // focuses when the dialog opens, through its autofocus
    var fields = Array.prototype.filter.call(
      document.querySelectorAll("[data-cmu-tap]"),
      function (f) {
        var d = f.closest("dialog");
        if (!d) return true;
        try {
          return d.matches(":modal");
        } catch {
          // A browser without :modal: wait for the autofocus
          return false;
        }
      },
    );
    if (fields.length === 1 && fields[0].getAttribute("data-cmu-tap") !== "click" && idle())
      focusTap(fields[0]);
  }
  document.addEventListener("click", function (e) {
    var target = e.target.closest && e.target.closest(".cmu-tap-target");
    if (target) focusTap(target.querySelector("[data-cmu-tap]"));
  });
  document.addEventListener("submit", function (e) {
    var field = e.target.querySelector && e.target.querySelector("[data-cmu-tap]");
    if (field)
      setTimeout(function () {
        focusTap(field);
      }, 0);
  });
  setInterval(keepTap, 2000);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startTap);
  else startTap();

  // File drop zone / picker: <label class="cmu-drop"> wrapping an <input
  // type="file">, its words and an empty <span class="cmu-drop-file">.
  // Choosing works without the script; with it, a file dragged onto the zone
  // is chosen too, the zone gets cmu-drop-over while one is over it and
  // cmu-drop-has-file once one is chosen, and cmu-drop-file names it. See File
  // Drop Zone / Picker in the docs (forms.html).
  function dropZone(e) {
    return e.target.closest && e.target.closest("label.cmu-drop");
  }
  function showFiles(zone) {
    var input = zone.querySelector('input[type="file"]');
    var shown = zone.querySelector(".cmu-drop-file");
    var names = Array.prototype.map.call(input.files || [], function (f) {
      return f.name;
    });
    zone.classList.toggle("cmu-drop-has-file", names.length > 0);
    if (shown) {
      shown.textContent = names.join(", ");
      shown.title = names.join(", ");
      shown.hidden = false; // an empty line keeps its place, so nothing moves
    }
  }
  ["dragenter", "dragover"].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var zone = dropZone(e);
      if (!zone) return;
      e.preventDefault();
      zone.classList.add("cmu-drop-over");
    });
  });
  document.addEventListener("dragleave", function (e) {
    var zone = dropZone(e);
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove("cmu-drop-over");
  });
  document.addEventListener("drop", function (e) {
    var zone = dropZone(e);
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove("cmu-drop-over");
    var input = zone.querySelector('input[type="file"]');
    if (!input || !e.dataTransfer || !e.dataTransfer.files.length) return;
    input.files = e.dataTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  document.addEventListener("change", function (e) {
    var zone = dropZone(e);
    if (zone && e.target.type === "file") showFiles(zone);
  });

  // Tab panels: tabs that switch content in place, in the same row and look as
  // the link tabs. <div class="cmu-tabs" role="tablist" aria-label="...">
  // holds <button type="button" role="tab" aria-controls="panel-id"> tabs, and
  // each panel is a <div role="tabpanel" id="panel-id">. Mark the open tab
  // aria-selected="true" (else the first opens) and the other panels hidden.
  // Click or arrow keys switch. With data-cmu-tabs="name" on the row and
  // data-cmu-tab="value" on each tab, every row with that name switches
  // together, and the choice is remembered in this browser across pages.
  // Without the script, every panel shows. See Tabs in the docs (layout.html).
  function tabsOf(list) {
    return Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
  }
  function selectTab(tab) {
    tabsOf(tab.closest('[role="tablist"]')).forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
  }
  function pickTabs(name, value) {
    document
      .querySelectorAll('.cmu-tabs[role="tablist"][data-cmu-tabs="' + name + '"]')
      .forEach(function (list) {
        var tabs = tabsOf(list);
        var tab =
          tabs.filter(function (t) {
            return t.getAttribute("data-cmu-tab") === value;
          })[0] || tabs[0];
        if (tab) selectTab(tab);
      });
  }
  function storedTab(name) {
    try {
      return localStorage.getItem("cmu-tabs:" + name);
    } catch {
      return null;
    }
  }
  function startTabs(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('.cmu-tabs[role="tablist"]').forEach(function (list) {
      if (list.cmuTabs) return;
      list.cmuTabs = true;
      var tabs = tabsOf(list);
      var name = list.getAttribute("data-cmu-tabs");
      var saved = name && storedTab(name);
      var tab =
        (saved &&
          tabs.filter(function (t) {
            return t.getAttribute("data-cmu-tab") === saved;
          })[0]) ||
        tabs.filter(function (t) {
          return t.getAttribute("aria-selected") === "true";
        })[0] ||
        tabs[0];
      if (tab) selectTab(tab);
    });
  }
  document.addEventListener("click", function (e) {
    var tab = e.target.closest && e.target.closest('.cmu-tabs[role="tablist"] [role="tab"]');
    if (!tab) return;
    var list = tab.closest('[role="tablist"]');
    var name = list.getAttribute("data-cmu-tabs");
    var value = tab.getAttribute("data-cmu-tab");
    if (!name || !value) return selectTab(tab);
    // Every row with this name switches; keep the clicked one still on screen
    var before = tab.getBoundingClientRect().top;
    pickTabs(name, value);
    try {
      localStorage.setItem("cmu-tabs:" + name, value);
    } catch {
      // Private window or blocked storage: the choice lasts for this page
    }
    window.scrollBy(0, tab.getBoundingClientRect().top - before);
  });
  document.addEventListener("keydown", function (e) {
    var list = e.target.closest && e.target.closest('.cmu-tabs[role="tablist"]');
    if (!list || e.target.getAttribute("role") !== "tab") return;
    var tabs = tabsOf(list);
    var i = tabs.indexOf(e.target);
    var to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    var tab = tabs[(to + tabs.length) % tabs.length];
    tab.focus();
    tab.click();
  });

  // Scroll gallery: <div class="cmu-scroll-gallery" data-cmu-scroll-gallery>
  // holds steps, <div class="cmu-scroll-gallery-step">, each with its text and
  // one <figure>. On a wide screen, the text scrolls on the left while a sticky
  // stage on the right shows the figure of the step in the middle of the
  // window, changing as the next step arrives: fading up, or with
  // cmu-scroll-gallery--slide, sliding in from the side in the direction of
  // scrolling. The stage holds copies, hidden from screen readers; the steps
  // keep their own figures, which show in place on a narrow screen or without
  // the script. See Scroll Gallery in the docs (sections.html).
  function startScrollGalleries(root) {
    if (!root.querySelectorAll || !window.IntersectionObserver) return;
    root.querySelectorAll("[data-cmu-scroll-gallery]").forEach(function (gallery) {
      if (gallery.querySelector(".cmu-scroll-gallery-stage")) return;
      var steps = Array.prototype.slice.call(gallery.querySelectorAll(".cmu-scroll-gallery-step"));
      if (!steps.length) return;
      var stage = document.createElement("div");
      stage.className = "cmu-scroll-gallery-stage";
      stage.setAttribute("aria-hidden", "true");
      stage.style.gridRow = "1 / span " + steps.length;
      var shown = steps.map(function (step) {
        var figure = step.querySelector("figure");
        var copy = figure ? figure.cloneNode(true) : document.createElement("figure");
        copy.querySelectorAll("a, button, [tabindex]").forEach(function (el) {
          el.setAttribute("tabindex", "-1");
        });
        stage.appendChild(copy);
        return copy;
      });
      gallery.appendChild(stage);
      gallery.classList.add("cmu-scroll-gallery--on");
      // Figures before the current one wait on one side and those after it
      // on the other, so each moves the way the page is scrolling
      function show(i) {
        shown.forEach(function (fig, n) {
          fig.classList.toggle("cmu-scroll-gallery-past", n < i);
          fig.classList.toggle("cmu-scroll-gallery-current", n === i);
          fig.classList.toggle("cmu-scroll-gallery-next", n > i);
        });
      }
      show(0);
      // A step is current once it crosses the middle of the window
      var watch = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) show(steps.indexOf(entry.target));
          });
        },
        { rootMargin: "-50% 0px -50% 0px" },
      );
      steps.forEach(function (step) {
        watch.observe(step);
      });
    });
  }

  startCountdowns(document);
  startTabs(document);
  startScrollGalleries(document);
  // Countdowns, sorting lists, email links and tabs added later start, and a countdown whose
  // date changes restarts
  new MutationObserver(function (changes) {
    changes.forEach(function (c) {
      if (c.type === "attributes") countdown(c.target);
      else
        c.addedNodes.forEach(function (n) {
          startCountdowns(n);
          startSorts(n);
          startEmails(n);
          startTabs(n);
          startScrollGalleries(n);
        });
    });
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-cmu-countdown"],
  });
})();
