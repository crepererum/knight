/**
 * This file is part of CERN Analysis Preservation Framework.
 * Copyright (C) 2015 CERN.
 *
 * CERN Analysis Preservation Framework is free software; you can
 * redistribute it and/or modify it under the terms of the GNU General
 * Public License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * CERN Analysis Preservation Framework is distributed in the hope that
 * it will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this software; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307,
 * USA.
 *
 */

/*eslint-env browser */
/*eslint camelcase: 0, comma-dangle: [2, "always-multiline"], quotes: [2, "single"] */

require(['jquery', 'base64', 'utf8', 'fuse', 'tv4', 'sortable'], function($, base64, utf8, Fuse, tv4, Sortable) {
  'use strict';

  $(function() {

    // general utils, not app specific
    var utils = {
        blob2json: function(blob) {
            /* JSON blob:
             *   // secure string
             *   base64:
             *     // 0x00-0xFF string (UTF-8)
             *     utf-8:
             *       // browser UTF-16 string, other string, ...
             *       stringify:
             *         JSON object
             */
            var str = utf8.decode(base64.decode(blob)).trim();
            if (str) {
                return JSON.parse(str);
            } else {
                return {};
            }
        },
    };

    var style = {
        icons: {
            iAdd: 'fa fa-fw fa-plus-circle',
            iArray: 'fa fa-fw fa-list',
            iBoolean: 'fa fa-fw fa-adjust',
            iNull: 'fa fa-fw fa-circle-thin',
            iNumber: 'fa fa-fw fa-bar-chart-o',
            iObject: 'fa fa-fw fa-cube',
            iRemove: 'fa fa-fw fa-minus-circle',
            iString: 'fa fa-fw fa-font',
            iUnknown: 'fa fa-fw fa-question',
        },
    };

    // high performance event dispatcher
    var eventDispatcher = {
        _registry: {},

        register: function(type, key, func) {
            if (!(type in eventDispatcher._registry)) {
                window.addEventListener(type, eventDispatcher._callback.bind(type));
                eventDispatcher._registry[type] = {};
            }

            var regType = eventDispatcher._registry[type];
            regType[key] = func;
        },

        bindToElement: function(element, key) {
            if (!element.knight_events) {
                element.knight_events = [];
            }
            if (element.knight_events.indexOf(key) === -1) {
                element.knight_events.push(key);
            }
        },

        dispatch: function(evt, target) {
            if (evt.type in eventDispatcher._registry) {
                return eventDispatcher._callback.apply(evt.type, [evt, target]);
            } else {
                return true;
            }
        },

        _callback: function(evt, target) {
            var element = target || evt.target;
            var regType = eventDispatcher._registry[this];

            // search for elements upward the hirarchy
            do {
                if (element.knight_events) {
                    // go through events that are registered for this element
                    for (var i = 0, ii = element.knight_events.length; i < ii; ++i) {
                        var key = element.knight_events[i];
                        if (key in regType) {
                            evt.knight_target = element;
                            var code = regType[key].apply(this, [evt, element]);
                            if (!code) {
                                evt.stopPropagation();
                                evt.preventDefault();
                                return false;
                            }
                        }
                    }
                }
            } while (element = element.parentNode);

            return true;
        },
    };

    function convertKeyEvents(evt) {
        var name = '';

        if (evt.ctrlKey) {
            name += 'CTRL-';
        }

        name += shim.keycodes[evt.keyCode] || 'UNKNOWN';

        var evt2 = new Event(name, {
            bubbles: true,
        });
        return eventDispatcher.dispatch(evt2, evt.target);
    }


    // cover to catch key events, lost focus clicks
    var cover = {
        create: function(target) {
            // element to cover page, for click handling
            var element = document.createElement('div');
            element.id = 'knight-cover';
            element.className = 'knight-cover';

            element.knight_target = target;
            element.knight_remove = cover.remove.bind(element);
            target.knight_cover = element;

            eventDispatcher.bindToElement(element, 'coverClose');
            eventDispatcher.bindToElement(document, 'coverClose');
            eventDispatcher.bindToElement(element, 'eatScroll');

            eventDispatcher.bindToElement(target, 'eatScroll');

            document.body.appendChild(element);
        },

        remove: function() {
            shim.remove(this.knight_target);
            shim.remove(this);
        },

        callbackClose: function() {
            var element = document.getElementById('knight-cover');
            if (element) {
                element.knight_remove();
                return false;
            } else {
                return true;
            }
        },
    };

    var searchBar = {
        create: function(element) {
            eventDispatcher.bindToElement(document, 'searchShow');
        },

        addToHistory: function(entry) {
            var h = JSON.parse(localStorage.getItem('searchHist')) || [];

            // test if element already exists
            // if so, remove it
            var idx = h.indexOf(entry);
            if (idx > -1) {
                h.splice(idx, 1);
            }

            // add element to the end
            h.push(entry);

            // limit history length to 50
            while (h.length > 50) {
                h.shift();
            }

            localStorage.setItem('searchHist', JSON.stringify(h));
            return h.length;
        },

        getFromHistory: function(pos) {
            var h = JSON.parse(localStorage.getItem('searchHist')) || [];
            if (h.length === 0 || pos <= 0) {
                return '';
            }
            pos = Math.min(h.length, pos);
            var idx = h.length - pos;
            return {
                entry: h[idx],
                pos: pos,
            };
        },

        searchViaString: function(query, anchor, show) {
            var tokens = query.split('.');
            var match = anchor.knight_match(tokens);
            var expanded = '';
            var lastElement = null;
            for (var i = 0, ii = match.length; i < ii; ++i) {
                if (match[i]) {
                    if (match[i].expanded) {
                        if (i > 0) {
                            expanded += '.';
                        }
                        expanded += match[i].expanded;
                    }

                    if (match[i].element) {
                        if (show && match[i].element.knight_show) {
                            match[i].element.knight_show();
                        }
                        lastElement = match[i].element;
                    }
                }
            }
            return {
                expanded: expanded,
                element: lastElement,
            }
        },

        callbackSearchShow: function(evt) {
            // create if not exist
            var container = document.getElementById('knight-searchcontainer');
            if (!container) {
                // construct searchbar
                container = document.createElement('div');
                container.id = 'knight-searchcontainer';
                container.className = 'knight-searchcontainer';
                container.knight_target = document.getElementById('knight-main');

                cover.create(container);

                var i = document.createElement('i');
                i.className = 'fa fa-fw fa-search';

                var input = document.createElement('input');
                input.className = 'knight-searchinput';
                container.knight_input = input;
                container.knight_historypos = 0;
                input.knight_container = container;
                eventDispatcher.bindToElement(input, 'historyUp');
                eventDispatcher.bindToElement(input, 'historyDown');

                eventDispatcher.bindToElement(container, 'searchSubmit');

                formHelpers.create_ab(i, input, container);
                document.body.appendChild(container);
            }

            container.knight_input.focus();
            return false;
        },

        callbackSearchSubmit: function(evt, element) {
            var container = element;
            var query = container.knight_input.value.trim();
            if (query.length > 0) {
                searchBar.addToHistory(query);
                container.knight_historypos = 0;

                var result = searchBar.searchViaString(query, container.knight_target, true);
                container.knight_input.value = result.expanded;
                container.knight_input.select();
                if (result.element) {
                    result.element.knight_focus();
                }
            }

            return false;
        },

        callbackHistoryUp: function(evt, element) {
            var container = element.knight_container;

            // save current state
            var current = container.knight_input.value.trim();
            if (container.knight_historypos === 0 && current.length > 0) {
                container.knight_statesaved = current;
            }

            var hdata = searchBar.getFromHistory(Math.min(50, container.knight_historypos + 1));
            container.knight_input.value = hdata.entry;
            container.knight_historypos = hdata.pos;
            container.knight_input.select();

            return false;
        },

        callbackHistoryDown: function(evt, element) {
            var container = element.knight_container;

            if (container.knight_historypos > 0) {
                container.knight_historypos = Math.max(0, container.knight_historypos - 1);
                if (container.knight_historypos > 0) {
                    var hdata = searchBar.getFromHistory(container.knight_historypos);
                    container.knight_input.value = hdata.entry;
                    container.knight_historypos = hdata.pos;
                } else {
                    container.knight_input.value = container.knight_statesaved || '';
                }
                container.knight_input.select();
            }

            return false;
        },
    };

    var ringMenu = {
        create: function(button, target) {
            button.knight_target = target;
            eventDispatcher.bindToElement(button, 'ringShow');
        },

        show: function(evt, button) {
            // ring menu
            var container = document.createElement('div');
            container.className = 'knight-ringcontainer';
            container.setAttribute('tabindex', 0); // enables .focus()
            container.knight_target = button.knight_target;

            // center container at mouse coords
            container.style.left = String(Math.max(evt.clientX - 50, 0)) + 'px';
            container.style.top = String(Math.max(evt.clientY - 50, 0)) + 'px';

            // element to cover page, for click handling
            cover.create(container);

            // icons
            var value = button.knight_target.knight_value();
            ringMenu.addIcon(container, 0, style.icons.iNull, null);
            ringMenu.addIcon(container, 60, style.icons.iArray, Array(value));
            ringMenu.addIcon(container, 2 * 60, style.icons.iString, String(JSON.stringify(value)));
            ringMenu.addIcon(container, 3 * 60, style.icons.iObject, {});
            ringMenu.addIcon(container, 4 * 60, style.icons.iNumber, Number(value));
            ringMenu.addIcon(container, 5 * 60, style.icons.iBoolean, false);

            document.body.appendChild(container);
            container.focus();

            return false;
        },

        addIcon: function(container, angle, className, data) {
            var rad = angle / 360 * Math.PI * 2;
            var i = document.createElement('i');
            i.className = className + ' knight-ringicon knight-button';
            i.style.position = 'absolute';
            i.knight_container = container;
            i.knight_data = data;

            // polar coords, substract half of the icon dimensions
            i.style.left = String(50 + 30 * Math.sin(rad) - 10) + 'px';
            i.style.top = String(50 + 30 * Math.cos(rad) - 10) + 'px';

            eventDispatcher.bindToElement(i, 'clickRingIcon');
            container.appendChild(i);

        },

        callbackIcon: function(evt, icon) {
            shim.remove(icon.knight_container.knight_target);
            gen(icon.knight_data, icon.knight_container.knight_target.knight_anchor);

            icon.knight_container.knight_cover.knight_remove();

            return false;
        },
    };

    // helpers to build up the form
    var formHelpers = {
        bindToAnchor: function(element, target) {
            // Make the anchor a proxy of the target.
            // This is requires to change to target (e.g. on type change),
            // but with the requirement to still have valid references.
            target.appendChild(element);
            target.knight_value = element.knight_value;
            target.knight_show = element.knight_show;
            target.knight_hide = element.knight_hide;
            target.knight_match = element.knight_match;
            target.knight_validate = element.knight_validate;
            target.knight_navprev = element.knight_navprev;
            target.knight_navnext = element.knight_navnext;
            target.knight_navin = element.knight_navin;
            target.knight_navout = element.knight_navout;
            target.knight_focus = element.knight_focus;
            target.knight_schema = element.knight_schema;
            target.knight_element = element;

            element.knight_parent = target.knight_parent;
            element.knight_anchor = target;
        },

        create_ab: function(a, b, container) {
            var container_a = document.createElement('div');
            container_a.className = 'knight-a';

            var container_b = document.createElement('div');
            container_b.className = 'knight-b';

            container_a.appendChild(a);
            container_b.appendChild(b);

            container.appendChild(container_a);
            container.appendChild(container_b);
        },

        show: function() {
            this.knight_target.style.display = '';
            this.className = 'fa fa-fw pull-right fa-chevron-down' + ' knight-button';
            this.knight_statehidden = false;
        },

        hide: function() {
            this.knight_target.style.display = 'none';
            this.className = 'fa fa-fw pull-right fa-chevron-right' + ' knight-button';
            this.knight_statehidden = true;
        },

        show_hide_toggle: function(evt, element) {
            var toggle = element.knight_toggle;
            if (toggle.knight_statehidden) {
                formHelpers.show.apply(toggle);
            } else {
                formHelpers.hide.apply(toggle);
            }

            return false;
        },

        callbackEat: function() {
            return false;
        },

        focus: function() {
            this.focus();

            // align viewport at top+50px
            var rect = this.getBoundingClientRect();
            window.scrollBy(0, rect.top - 50);
        },

        callbackNavnext: function(evt, element) {
            element.knight_navnext();
            return false;
        },

        callbackNavprev: function(evt, element) {
            element.knight_navprev();
            return false;
        },

        callbackNavin: function(evt, element) {
            element.knight_navin();
            return false;
        },

        callbackNavout: function(evt, element) {
            element.knight_navout();
            return false;
        },
    };

    var mixinElementSimple = {
        create: function(anchor, containerClassName, iconClassName, input, valueFunction) {
            var container = document.createElement('div');
            container.className = containerClassName;

            var i = document.createElement('i');
            ringMenu.create(i, container);
            i.className = iconClassName + ' knight-button';

            formHelpers.create_ab(i, input, container);
            container.knight_value = valueFunction.bind(input);
            container.knight_focus = formHelpers.focus.bind(input);
            container.knight_match = mixinElementSimple.match.bind(container);
            container.knight_validate = mixinElementSimple.validate.bind(container);

            // navigation events usually arrow keys, which are eaten by the input
            // element. therefore we need to bind it to the input element as well
            container.knight_navnext = mixinElementSimple.navnext.bind(container);
            container.knight_navprev = mixinElementSimple.navprev.bind(container);
            container.knight_navin = mixinElementSimple.navin.bind(container);
            container.knight_navout = mixinElementSimple.navout.bind(container);

            input.knight_navnext = mixinElementSimple.navnext.bind(container);
            input.knight_navprev = mixinElementSimple.navprev.bind(container);
            input.knight_navin = mixinElementSimple.navin.bind(container);
            input.knight_navout = mixinElementSimple.navout.bind(container);

            eventDispatcher.bindToElement(container, 'navnext');
            eventDispatcher.bindToElement(container, 'navprev');
            eventDispatcher.bindToElement(container, 'navin');
            eventDispatcher.bindToElement(container, 'navout');

            eventDispatcher.bindToElement(input, 'navnext');
            eventDispatcher.bindToElement(input, 'navprev');
            eventDispatcher.bindToElement(input, 'navin');
            eventDispatcher.bindToElement(input, 'navout');

            formHelpers.bindToAnchor(container, anchor);
        },

        match: function(tokens) {
            if (tokens.length === 0) {
                return [];
            } else {
                var head = tokens[0];
                var value = String(this.knight_value()).toLowerCase();
                var f = new Fuse([value], {
                    includeScore: true,
                });
                var m = f.search(String(head).trim().toLowerCase());
                if (m.length > 0) {
                    return [{
                        token: head,
                        expanded: value,
                        element: this,
                        score: 1.0 - m[0].score,
                    }];
                } else {
                    return [{
                        token: head,
                        expanded: value,
                        element: this,
                        score: 0,
                    }];
                }
            }
        },

        validate: function() {
            /* noop */
        },

        navnext: function() {
            if (this.knight_parent) {
                this.knight_parent.knight_navnext(this);
            }
        },

        navprev: function() {
            if (this.knight_parent) {
                this.knight_parent.knight_navprev(this);
            }
        },

        navin: function() {
            this.knight_focus();
        },

        navout: function() {
            if (this.knight_parent) {
                this.knight_parent.knight_focus();
            }
        },
    };

    var elementArray = {
        gen: function(data, target) {
            // container for the array form
            var container = document.createElement('div');
            container.className = 'knight-array';
            container.setAttribute('tabindex', 0); // enables .focus()
            container.knight_subs = [];
            container.knight_value = elementArray.value.bind(container);
            container.knight_match = elementArray.match.bind(container);
            container.knight_validate = elementArray.validate.bind(container);
            container.knight_navnext = elementArray.navnext.bind(container);
            container.knight_navprev = elementArray.navprev.bind(container);
            container.knight_navin = elementArray.navin.bind(container);
            container.knight_navout = elementArray.navout.bind(container);

            eventDispatcher.bindToElement(container, 'navnext');
            eventDispatcher.bindToElement(container, 'navprev');
            eventDispatcher.bindToElement(container, 'navin');
            eventDispatcher.bindToElement(container, 'navout');

            // head for metadata and buttons
            var head = document.createElement('div');
            head.className = 'knight-arrayhead';

            // body for array content
            var body = document.createElement('ol');
            body.className = 'knight-arraybody';
            container.knight_body = body;

            // scrollhelper that wraps the body
            var scrollhelper = document.createElement('div');
            scrollhelper.className = 'knight-scrollhelper';

            // type indicator
            var i = document.createElement('i');
            i.className = style.icons.iArray + ' knight-button';
            ringMenu.create(i, container);
            head.appendChild(i);

            // add button
            var plus = document.createElement('i');
            plus.className = style.icons.iAdd + ' knight-button';
            plus.knight_container = container;
            eventDispatcher.bindToElement(plus, 'arrayModifyAdd');
            head.appendChild(plus);

            // delete button
            var minus = document.createElement('i');
            minus.className = style.icons.iRemove + ' knight-button';
            minus.knight_container = container;
            eventDispatcher.bindToElement(minus, 'arrayModifyDelete');
            head.appendChild(minus);

            // counter
            var counter = document.createElement('span');
            container.knight_counter = counter;
            shim.textContentSet(counter, data.length);
            head.appendChild(counter);

            // show-hide toggle
            var toggle = document.createElement('i');
            toggle.knight_target = scrollhelper;
            head.knight_toggle = toggle;
            eventDispatcher.bindToElement(head, 'showHideToggle');
            head.appendChild(toggle);
            container.knight_show = formHelpers.show.bind(toggle);
            container.knight_hide = formHelpers.hide.bind(toggle);

            // array data
            for (var i = 0, ii = data.length; i < ii; ++i) {
                elementArray.genSub(data[i], container);
            }

            // initial state?
            if (container.knight_subs.length > 5) {
                formHelpers.hide.bind(toggle)();
            } else {
                formHelpers.show.bind(toggle)();
            }

            // make it sortable
            Sortable.create(body);

            container.knight_focus = formHelpers.focus.bind(body);

            // assemble
            var margin = document.createElement('div');
            margin.className = 'knight-marginhelper';
            scrollhelper.appendChild(body);
            margin.appendChild(head);
            margin.appendChild(scrollhelper);
            container.appendChild(margin);

            formHelpers.bindToAnchor(container, target);
        },

        value: function() {
            // get bind context
            var element = this;

            var result = [];
            for (var i = 0, ii = element.knight_subs.length; i < ii; ++i) {
                var sub = element.knight_subs[i];
                result.push(sub.knight_value());
            }
            return result;
        },

        genSub: function(data, container) {
            var subcontainer = document.createElement('li');
            subcontainer.className = 'knight-arrayrow';
            subcontainer.knight_parent = container;
            gen(data, subcontainer);

            container.knight_body.appendChild(subcontainer);
            container.knight_subs.push(subcontainer);
        },

        modifyAdd: function(evt, element) {
            var container = element.knight_container;

            // try to copy the last element
            var data = null;
            if (container.knight_subs.length > 0) {
                data = container.knight_subs[container.knight_subs.length - 1].knight_value();
            }

            elementArray.genSub(data, container);
            shim.textContentSet(container.knight_counter, container.knight_subs.length);

            return false;
        },

        modifyDelete: function(evt, element) {
            var container = element.knight_container;

            if (container.knight_subs.length > 0) {
                container.knight_subs.pop();
                container.knight_body.removeChild(container.knight_body.lastChild);
                shim.textContentSet(container.knight_counter, container.knight_subs.length);
            }

            return false;
        },

        match: function(tokens) {
            var container = this;

            if (tokens.length === 0) {
                return [];
            } else {
                var head = tokens[0];
                var query = String(head).trim();

                // wildcard or index?
                if (query === '*') {
                    // find best matching element
                    var bestElement = null;
                    var bestSub = [];
                    var bestScore = 0;
                    var bestIdx = null;
                    for (var i = 0, ii = container.knight_subs.length; i < ii; ++i) {
                        var element = container.knight_subs[i];
                        var sub = element.knight_match(tokens.slice(1));
                        if (sub[0]) {
                            var score = sub[0].score;
                            if (score > bestScore) {
                                bestScore = score;
                                bestElement = element;
                                bestSub = sub;
                                bestIdx = String(i);
                            }
                        }
                    }

                    var result = [{
                        token: head,
                        expanded: bestIdx,
                        element: bestElement,
                        score: bestScore,
                    }];
                    result = result.concat(bestSub);
                } else {
                    var index = parseInt(query) - 1;
                    var element = null;
                    var expanded = null;
                    var score = 0;
                    if (!isNaN(index) && index >= 0 && index < container.knight_subs.length) {
                        element = container.knight_subs[index];
                        expanded = String(index + 1);
                        // that seems to be a nice function to me
                        // normalized to [0,1] and depending on something like the entropy
                        score = 1.0 - 1.0 / (1.0 + Math.log(1.0 + container.knight_subs.length));
                    }

                    var result = [{
                        token: head,
                        expanded: expanded,
                        element: element,
                        score: score,
                    }];

                    if (element && element.knight_match) {
                        var sub = element.knight_match(tokens.slice(1));
                        if (sub[0]) {
                            result[0].score *= sub[0].score;
                        }
                        result = result.concat(sub);
                    }
                }

                return result;
            }
        },

        validate: function() {
            for (var i = 0, ii = this.knight_subs.length; i < ii; ++i) {
                this.knight_subs[i].knight_validate();
            }
        },

        navnext: function(last) {
            var idx;

            if (last) {
                last = last.knight_anchor || last;
                idx = this.knight_subs.indexOf(last) + 1; // (-1 + 1)=0 when not found
            } else {
                idx = 0;
            }

            if (idx < this.knight_subs.length) {
                this.knight_subs[idx].knight_focus();
            } else if (this.knight_parent) {
                this.knight_parent.knight_navnext(this);
            }
        },

        navprev: function(last) {
            var idx;

            if (last) {
                last = last.knight_anchor || last;
                idx = this.knight_subs.indexOf(last) - 1; // (-1 - 1)=-2 when not found
            } else {
                idx = this.knight_subs.length - 1;
            }

            if (idx >= 0) {
                this.knight_subs[idx].knight_focus();
            } else if (this.knight_parent) {
                this.knight_parent.knight_navprev(this);
            }
        },

        navin: function() {
            if (this.knight_subs.length > 0) {
                this.knight_subs[0].knight_focus();
            }
        },

        navout: function() {
            if (this.knight_parent) {
                this.knight_parent.knight_focus();
            }
        },
    };

    var elementBoolean = {
        gen: function(data, anchor) {
            var input = document.createElement('input');
            input.setAttribute('type', 'checkbox');
            input.checked = data;

            mixinElementSimple.create(anchor, 'knight-boolean', style.icons.iBoolean, input, elementBoolean.value);
        },

        value: function() {
            // get bind context
            var element = this;

            return element.checked;
        },
    };

    var elementNull = {
        gen: function(data, anchor) {
            var p = document.createElement('p');
            p.className = 'knight-null';
            p.innerHTML = 'null';
            p.setAttribute('tabindex', 0); // enables .focus()

            mixinElementSimple.create(anchor, 'knight-null', style.icons.iNull, p, elementNull.value);
        },

        value: function() {
            return null;
        },
    };

    var elementNumber = {
        gen: function(data, anchor) {
            var input = document.createElement('input');
            input.setAttribute('type', 'number');
            input.value = data;

            mixinElementSimple.create(anchor, 'knight-number', style.icons.iNumber, input, elementNumber.value);
        },

        value: function() {
            // get bind context
            var element = this;

            return Number(element.value);
        },
    };

    var elementObject = {
        gen: function(data, target) {
            var keys = Object.keys(data);

            // object container
            var container = document.createElement('div');
            container.className = 'knight-object';
            container.setAttribute('tabindex', 0); // enables .focus()
            container.knight_subs = [];
            container.knight_value = elementObject.value.bind(container);
            container.knight_match = elementObject.match.bind(container);
            container.knight_validate = elementObject.validate.bind(container);
            container.knight_navnext = elementObject.navnext.bind(container);
            container.knight_navprev = elementObject.navprev.bind(container);
            container.knight_navin = elementObject.navin.bind(container);
            container.knight_navout = elementObject.navout.bind(container);

            eventDispatcher.bindToElement(container, 'navnext');
            eventDispatcher.bindToElement(container, 'navprev');
            eventDispatcher.bindToElement(container, 'navin');
            eventDispatcher.bindToElement(container, 'navout');

            // head for metadata and buttons
            var head = document.createElement('div');
            head.className = 'knight-objecthead';

            // body for object content
            var body = document.createElement('div');
            body.className = 'knight-objectbody';
            container.knight_body = body;

            // type indicator
            var i = document.createElement('i');
            i.className = style.icons.iObject + ' knight-button';
            ringMenu.create(i, container);
            head.appendChild(i);

            // add button
            var plus = document.createElement('i');
            plus.className = style.icons.iAdd + ' knight-button';
            plus.knight_container = container;
            eventDispatcher.bindToElement(plus, 'objectModifyAdd');
            head.appendChild(plus);

            // delete button
            var minus = document.createElement('i');
            minus.className = style.icons.iRemove + ' knight-button';
            minus.knight_container = container;
            eventDispatcher.bindToElement(minus, 'objectModifyDelete');
            head.appendChild(minus);

            // counter
            var counter = document.createElement('span');
            container.knight_counter = counter;
            shim.textContentSet(counter, keys.length);
            head.appendChild(counter);

            // show-hide toggle
            var toggle = document.createElement('i');
            head.knight_toggle = toggle;
            toggle.knight_target = body;
            eventDispatcher.bindToElement(head, 'showHideToggle');
            head.appendChild(toggle);
            container.knight_show = formHelpers.show.bind(toggle);
            container.knight_hide = formHelpers.hide.bind(toggle);

            // add content
            for (var i = 0, ii = keys.length; i < ii; ++i) {
                var k = keys[i];
                var v = data[k];
                elementObject.genSub(k, v, container);
            }

            // initial state?
            if (container.knight_subs.length > 10) {
                formHelpers.hide.bind(toggle)();
            } else {
                formHelpers.show.bind(toggle)();
            }

            // make it sortable
            Sortable.create(body);

            container.knight_focus = formHelpers.focus.bind(container);

            // assemble object
            var margin = document.createElement('div');
            margin.className = 'knight-marginhelper';
            margin.appendChild(head);
            margin.appendChild(body);
            container.appendChild(margin);

            // bind
            formHelpers.bindToAnchor(container, target);
        },

        value: function() {
            // get bind context
            var element = this;

            var result = {};
            for (var i = 0, ii = element.knight_subs.length; i < ii; ++i) {
                var sub = element.knight_subs[i];
                result[sub.knight_key()] = sub.knight_value();
            }
            return result;
        },

        valueLabel: function() {
            // get text content without newline
            return shim.textContentGet(this).replace(/\n/g, '');
        },

        valueInput: function() {
            return this.knight_value();
        },

        genSub: function(k, v, container) {
            var subcontainer = document.createElement('div');
            subcontainer.className = 'knight-objectrow';

            // use a <p> element instead of <label>, because
            // on Firefox label+contentEditable behaves strangely
            // when selecting text or positioning the cursor
            var label = document.createElement('p');
            label.className = 'knight-label';
            label.setAttribute('contentEditable', true);
            label.knight_parent = container;
            label.knight_focus = formHelpers.focus.bind(label);
            label.knight_validate = mixinElementSimple.validate.bind(label);
            label.knight_navnext = mixinElementSimple.navnext.bind(label);
            label.knight_navprev = mixinElementSimple.navprev.bind(label);
            label.knight_navin = elementObject.navinLabel.bind(label);
            label.knight_navout = mixinElementSimple.navout.bind(label);

            eventDispatcher.bindToElement(label, 'navnext');
            eventDispatcher.bindToElement(label, 'navprev');
            eventDispatcher.bindToElement(label, 'navin');
            eventDispatcher.bindToElement(label, 'navout');

            shim.textContentSet(label, k);

            var input = document.createElement('div');
            input.className = 'knight-sub';
            input.knight_parent = container;
            label.knight_input = input;
            gen(v, input);

            subcontainer.appendChild(label);
            subcontainer.knight_key = elementObject.valueLabel.bind(label);
            subcontainer.knight_label = label;

            subcontainer.appendChild(input);
            subcontainer.knight_value = elementObject.valueInput.bind(input);
            subcontainer.knight_input = input;

            container.knight_body.appendChild(subcontainer);
            container.knight_subs.push(subcontainer);
        },

        modifyAdd: function(evt, element) {
            var container = element.knight_container;

            // try to copy the last element
            var k = 'new';
            var v = null;
            if (container.knight_subs.length > 0) {
                k = container.knight_subs[container.knight_subs.length - 1].knight_key();
                v = container.knight_subs[container.knight_subs.length - 1].knight_value();
            }

            elementObject.genSub(k, v, container);
            shim.textContentSet(container.knight_counter, container.knight_subs.length);

            evt.stopPropagation();
        },

        modifyDelete: function(evt, element) {
            var container = element.knight_container;

            if (container.knight_subs.length > 0) {
                container.knight_subs.pop();
                container.knight_body.removeChild(container.knight_body.lastChild);
                shim.textContentSet(container.knight_counter, container.knight_subs.length);
            }

            evt.stopPropagation();
        },

        match: function(tokens) {
            var container = this;

            if (tokens.length === 0) {
                return [];
            } else {
                var head = tokens[0];
                var bestK = null;
                var bestV = null;
                var score = 0;

                var keys = [];
                for (var i = 0, ii = container.knight_subs.length; i < ii; ++i) {
                    keys.push(container.knight_subs[i].knight_key().toLowerCase());
                }
                var f = new Fuse(keys, {
                    includeScore: true,
                });
                var m = f.search(String(head).trim().toLowerCase());
                if (m) {
                    // get lowest score
                    // FIXME do not sort the entire list
                    m.sort(function(a, b) {
                        return a.score - b.score;
                    });
                    var idx = m[0].item;
                    bestK = container.knight_subs[idx].knight_key();
                    bestV = container.knight_subs[idx].knight_input;
                    score = 1.0 - m[0].score;
                }

                var result = [{
                    token: head,
                    expanded: bestK,
                    element: bestV,
                    score: score,
                }];

                if (bestV && bestV.knight_match) {
                    if (bestV && bestV.knight_match) {
                        var sub = bestV.knight_match(tokens.slice(1));
                        if (sub[0]) {
                            result[0].score *= sub[0].score;
                        }
                        result = result.concat(sub);
                    }
                }

                return result;
            }
        },

        validate: function() {
            var i, ii, knownKeys;

            knownKeys = {};
            for (i = 0, ii = this.knight_subs.length; i < ii; ++i) {
                this.knight_subs[i].knight_label.knight_validate();
                this.knight_subs[i].knight_input.knight_validate();
                var k = this.knight_subs[i].knight_key();
                if (k in knownKeys) {
                    ++knownKeys[k];
                } else {
                    knownKeys[k] = 1;
                }
            }

            for (i = 0, ii = this.knight_subs.length; i < ii; ++i) {
                var k = this.knight_subs[i].knight_key();
                if (knownKeys[k] > 1) {
                    annotations.add('errorstate', 'Duplicate key', this.knight_subs[i].knight_label);
                }
            }
        },

        indexOfLabel: function(subs, label) {
            var idx = -1;
            for (var i = 0, ii = subs.length; i < ii; ++i) {
                if (subs[i].knight_label === label) {
                    idx = i;
                    break;
                }
            }
            return idx;
        },

        indexOfInput: function(subs, input) {
            var idx = -1;
            for (var i = 0, ii = subs.length; i < ii; ++i) {
                if (subs[i].knight_input === input) {
                    idx = i;
                    break;
                }
            }
            return idx;
        },

        navnext: function(last) {
            var idx;
            var isInput = false;

            if (last) {
                last = last.knight_anchor || last;
                idx = elementObject.indexOfInput(this.knight_subs, last) + 1; // (-1 + 1)=0 when not found
                if (idx > 0) {
                    isInput = true;
                } else {
                    idx = elementObject.indexOfLabel(this.knight_subs, last) + 1; // (-1 + 1)=0 when not found
                }
            } else {
                idx = 0;
            }

            if (idx < this.knight_subs.length) {
                if (isInput) {
                    this.knight_subs[idx].knight_input.knight_focus();
                } else {
                    this.knight_subs[idx].knight_label.knight_focus();
                }
            } else if (this.knight_parent) {
                this.knight_parent.knight_navnext(this);
            }
        },

        navprev: function(last) {
            var idx;
            var isInput = false;

            if (last) {
                last = last.knight_anchor || last;
                idx = elementObject.indexOfInput(this.knight_subs, last) - 1; // (-1 - 1)=-2 when not found
                if (idx > -2) {
                    isInput = true;
                } else {
                    idx = elementObject.indexOfLabel(this.knight_subs, last) - 1; // (-1 - 1)=-2 when not found
                }
            } else {
                idx = this.knight_subs.length - 1;
            }

            if (idx >= 0) {
                if (isInput) {
                    this.knight_subs[idx].knight_input.knight_focus();
                } else {
                    this.knight_subs[idx].knight_label.knight_focus();
                }
            } else if (this.knight_parent) {
                this.knight_parent.knight_navprev(this);
            }
        },

        navin: function() {
            if (this.knight_subs.length > 0) {
                this.knight_subs[0].knight_label.knight_focus();
            }
        },

        navout: function() {
            if (this.knight_parent) {
                this.knight_parent.knight_focus();
            }
        },

        navinLabel: function() {
            this.knight_input.knight_focus();
        },
    };

    var elementString = {
        gen: function(data, anchor) {
            var input = document.createElement('p');
            input.setAttribute('contentEditable', true);
            shim.textContentSet(input, data);

            mixinElementSimple.create(anchor, 'knight-string', style.icons.iString, input, elementString.value);
        },

        value: function() {
            // get bind context
            var element = this;

            return shim.textContentGet(element);
        },
    };

    var elementUnknown = {
        gen: function(data, anchor) {
            var input = document.createElement('input');
            input.className = 'knight-unkown';
            input.value = data;

            mixinElementSimple.create(anchor, 'knight-unknown', style.icons.iUnknown, input, elementUnknown.value);
        },

        value: function() {
            return this.value;
        },
    };

    function gen(data, target) {
        if (data === null) {
            return elementNull.gen(data, target);
        } else if (Array.isArray(data)) {
            return elementArray.gen(data, target);
        } else if (typeof(data) === 'boolean') {
            return elementBoolean.gen(data, target);
        } else if (typeof(data) === 'number') {
            return elementNumber.gen(data, target);
        } else if (typeof(data) === 'string') {
            return elementString.gen(data, target);
        } else if (typeof(data) === 'object') {
            return elementObject.gen(data, target);
        } else {
            return elementUnknown.gen(data, target);
        }
    }

    // shim and compatility functions
    // might contain some black magic to make things work across browser
    // boundaries
    var shim = {
        prependChild: function(element, child) {
            if (element.firstChild) {
                element.insertBefore(child, element.firstChild);
            } else {
                element.appendChild(child);
            }
        },

        textContentGet: function(element, single) {
            if (element.nodeType === 3) {
                // textnode
                return element.wholeText;
            } else if (element.tagName === 'BR') {
                // special line breaking tags
                // ignore them, if there are the only ones
                // in the context
                if (single) {
                    return '';
                } else {
                    return '\n';
                }
            } else {
                var parts = [];

                // DIV introduces a linebreak if mixed with other
                // elements
                if (element.tagName === 'DIV' && !single) {
                    parts.push('\n');
                }

                // process child nodes
                var subsingle = element.childNodes.length < 2;
                for (var i = 0, ii = element.childNodes.length; i < ii; ++i) {
                    parts.push(shim.textContentGet(element.childNodes[i], subsingle));
                }

                return parts.join('');
            }
        },

        textContentSet: function(element, s) {
            // empty element
            // http://stackoverflow.com/a/3955238
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }

            // add one child per newline
            var parts = String(s).split('\n');
            for (var i = 0, ii = parts.length; i < ii; ++i) {
                if (i > 0) {
                    var br = document.createElement('br');
                    element.appendChild(br);
                }

                var node = document.createTextNode(parts[i]);
                element.appendChild(node);
            }
        },

        remove: function(element) {
            var p = element.parentNode;
            if (p) {
                p.removeChild(element);
            }
        },

        replace: function(next, element) {
            var p = element.parentNode;
            if (p) {
                p.replaceChild(next, element);
            }
        },

        keycodes: {
            0x0D: 'ENTER',
            0x1B: 'ESCAPE',
            0x20: 'SPACE',
            0x25: 'ARROWLEFT',
            0x26: 'ARROWUP',
            0x27: 'ARROWRIGHT',
            0x28: 'ARROWDOWN',
        },
    };

    var annotations = {
        clear: function(type) {
            // HTMLColleciton to Array, because we remove elements from the collection
            var oldErrors = [].slice.call(document.getElementsByClassName('knight-annotation-' + type));
            for (var i = 0, ii = oldErrors.length; i < ii; ++i) {
                oldErrors[i].knight_target.classList.remove('knight-status-error');
                shim.remove(oldErrors[i]);
            }
        },

        add: function(type, msg, target) {
            var anchor = document.createElement('div');
            anchor.className = 'knight-annotation-' + type;
            anchor.knight_target = target;

            var container = document.createElement('div');
            container.knight_target = target;

            var i = document.createElement('i');
            i.className = 'fa fa-fw fa-exclamation-triangle';

            var p = document.createElement('p');
            shim.textContentSet(p, msg);

            formHelpers.create_ab(i, p, container);
            eventDispatcher.bindToElement(container, 'annotationClick');

            anchor.appendChild(container);
            shim.prependChild(target, anchor);
            target.classList.add('knight-status-error');
        },

        callbackClick: function(evt, element) {
            element.knight_target.knight_focus();
            return false;
        },
    };

    function fullValidation(element, data, schema, callback) {
        // FIXME thing about .validateMultiple
        var result = tv4.validateResult(data, schema);

        // external schema missing?
        if (result.missing.length > 0) {
            var url = result.missing[0];
            // FIXME implement host whitelist
            $.getJSON(url, function(subschema) {
                tv4.addSchema(url, subschema);

                // try again
                fullValidation(element, data, schema, callback);
            });
        } else {
            // clean up
            annotations.clear('errorschema');

            if (!result.valid) {
                // try to find affected element
                var target = document.getElementById('knight-main').knight_element;
                if (result.error.dataPath.length > 0) {
                    var query = result.error.dataPath.replace(/\//g, '.').slice(1);
                    var sresult = searchBar.searchViaString(query, target, true);
                    if (sresult.element) {
                        target = sresult.element.knight_element || sresult.element;
                    }
                }

                // add annotations to obj tree
                annotations.add('errorschema', result.error.message, target);
            }

            if (callback) {
                callback.apply(this, [result]);
            }
        }
    }

    function validationDelay() {
        window.setTimeout(validationLoop, 1000);
    }

    function validationLoop() {
        var element = document.getElementById('knight-main');

        // clean up
        annotations.clear('errorstate');

        // internal validation
        // this state might change even if the resulting .knight_value()
        // stays the same
        element.knight_validate();

        var schema = element.knight_schema;
        var value = element.knight_value();
        var valueOld = element.knight_cachedvalue;
        element.knight_cachedvalue = JSON.stringify(value);
        if (element.knight_cachedvalue !== valueOld) {
            fullValidation(element, value, schema, validationDelay);
        } else {
            validationDelay();
        }
    }


    // event dispatcher table
    eventDispatcher.register('keydown', 'keyConvert', convertKeyEvents);
    eventDispatcher.register('click', 'showHideToggle', formHelpers.show_hide_toggle);
    eventDispatcher.register('click', 'ringShow', ringMenu.show);
    eventDispatcher.register('click', 'clickRingIcon', ringMenu.callbackIcon);
    eventDispatcher.register('click', 'coverClose', cover.callbackClose);
    eventDispatcher.register('click', 'arrayModifyAdd', elementArray.modifyAdd);
    eventDispatcher.register('click', 'arrayModifyDelete', elementArray.modifyDelete);
    eventDispatcher.register('click', 'objectModifyAdd', elementObject.modifyAdd);
    eventDispatcher.register('click', 'objectModifyDelete', elementObject.modifyDelete);
    eventDispatcher.register('click', 'annotationClick', annotations.callbackClick);
    eventDispatcher.register('wheel', 'eatScroll', formHelpers.callbackEat);
    eventDispatcher.register('ESCAPE', 'coverClose', cover.callbackClose);
    eventDispatcher.register('ENTER', 'coverClose', cover.callbackClose);
    eventDispatcher.register('CTRL-SPACE', 'searchShow', searchBar.callbackSearchShow);
    eventDispatcher.register('ENTER', 'searchSubmit', searchBar.callbackSearchSubmit);
    eventDispatcher.register('ARROWUP', 'historyUp', searchBar.callbackHistoryUp);
    eventDispatcher.register('ARROWDOWN', 'historyDown', searchBar.callbackHistoryDown);
    eventDispatcher.register('CTRL-ARROWUP', 'navprev', formHelpers.callbackNavprev);
    eventDispatcher.register('CTRL-ARROWDOWN', 'navnext', formHelpers.callbackNavnext);
    eventDispatcher.register('CTRL-ARROWRIGHT', 'navin', formHelpers.callbackNavin);
    eventDispatcher.register('CTRL-ARROWLEFT', 'navout', formHelpers.callbackNavout);

    eventDispatcher.bindToElement(document, 'keyConvert');

    $('.jsonrecord').each(function() {
        var element = this;
        $.getJSON($(element).data('schema'), function(schema) {
            var loading = $('.jsonrecord-loading', element)[0];
            var blob_container = $('.jsonrecord-blob', element)[0];
            var json = utils.blob2json($(blob_container).text());
            var target = $('.jsonrecord-rendered', element)[0];
            var id = $(element).data('id');

            // create document fragment to avoid reflows
            var fragment = document.createDocumentFragment();
            var fragment_div = document.createElement('div');
            fragment_div.id = 'knight-main';
            fragment_div.className = 'knight-main';
            fragment.appendChild(fragment_div);

            gen(json, fragment_div);

            // show outer element
            if (fragment_div.knight_show) {
                fragment_div.knight_show();
            }

            // add schema
            // FIXME set schema during generation, so it can influence the form
            fragment_div.knight_schema = schema;

            // initialize search
            searchBar.create(fragment_div);

            // add clearfix
            var clearfix = document.createElement('div');
            clearfix.className = 'clearfix knight-end';
            fragment.appendChild(clearfix);

            target.appendChild(fragment);
            $(loading).remove();

            // start validation loop
            validationLoop();
        });
    });
  });
});
