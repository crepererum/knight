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
 */

require(['jquery', 'base64', 'utf8'], function($, base64, utf8) {
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
        },
    };

    // cover to catch key events, lost focus clicks
    var cover = {
        create: function(target) {
            // element to cover page, for click handling
            var element = document.createElement('div');
            element.className = 'knight-cover';

            element.knight_target = target;
            target.knight_cover = element;

            element.addEventListener('click', cover.callbackClick.bind(element));
            element.addEventListener('wheel', formHelpers.callbackEat);

            target.addEventListener('wheel', formHelpers.callbackEat);

            window.addEventListener('keydown', cover.callbackKeydown.bind(element));
            document.body.appendChild(element);
        },

        callbackClick: function(evt) {
            shim.remove(this.knight_target);
            shim.remove(this);

            evt.stopPropagation();
        },

        callbackKeydown: function(evt) {
            // ESC
            if (evt.keyCode == 0x1B) {
                evt.stopPropagation();
                evt.preventDefault();

                shim.remove(this.knight_target);
                shim.remove(this);
            }

            // CTRL-SPACE
            if ((evt.keyCode == 0x20) && evt.ctrlKey) {
                evt.stopPropagation();
                evt.preventDefault();
            }
        },
    };

    var searchBar = {
        create: function(element) {
            window.addEventListener('keydown', searchBar.callbackGlobalKeydown.bind(element));
        },

        callbackGlobalKeydown: function(evt) {
            // CTRL-SPACE
            if ((evt.keyCode == 0x20) && evt.ctrlKey) {
                evt.stopPropagation();
                evt.preventDefault();

                // create if not exist
                var container = document.getElementById('knight-searchcontainer');
                if (!container) {
                    // construct searchbar
                    container = document.createElement('div');
                    container.id = 'knight-searchcontainer';
                    container.className = 'knight-searchcontainer';
                    container.knight_target = this;

                    cover.create(container);

                    var input = document.createElement('input');
                    input.className = 'knight-searchinput';
                    container.knight_input = input;

                    container.addEventListener('keydown', searchBar.callbackLocalKeydown.bind(container));

                    container.appendChild(input);
                    document.body.appendChild(container);
                }

                container.knight_input.focus();
            }
        },

        callbackLocalKeydown: function(evt) {
            // ENTER
            if (evt.keyCode == 0x0D) {
                evt.stopPropagation();
                evt.preventDefault();

                var tokens = this.knight_input.value.split('.');
                var match = this.knight_target.knight_match(tokens);
                var expanded = '';
                for (var i = 0; i < match.length; ++i) {
                    if (match[i]) {
                        if (match[i].expanded) {
                            if (i > 0) {
                                expanded += '.';
                            }
                            expanded += match[i].expanded;
                        }

                        if (match[i].element) {
                            if (match[i].element.knight_show) {
                                match[i].element.knight_show();
                            }
                            var lastElement = match[i].element;
                        }
                    }
                }
                this.knight_input.value = expanded;
                if (lastElement) {
                    lastElement.knight_focus();
                }
            }

            // CTRL-SPACE
            if ((evt.keyCode == 0x20) && evt.ctrlKey) {
                evt.stopPropagation();
                evt.preventDefault();
            }
        },
    };

    var ringMenu = {
        create: function(button, target) {
            button.addEventListener('click', ringMenu.show.bind(target));
        },

        show: function(evt) {
            // ring menu
            var container = document.createElement('div');
            container.className = 'knight-ringcontainer';

            // center container at mouse coords
            container.style.left = String(Math.max(evt.clientX - 50, 0)) + 'px';
            container.style.top = String(Math.max(evt.clientY - 50, 0)) + 'px';

            // element to cover page, for click handling
            cover.create(container);

            // icons
            var value = this.knight_value();
            ringMenu.addIcon(container, 0, style.icons.iNull, ringMenu.callbackIcon.bind({
                data: null,
                target: this,
                container: container,
            }));
            ringMenu.addIcon(container, 60, style.icons.iArray, ringMenu.callbackIcon.bind({
                data: Array(value),
                target: this,
                container: container,
            }));
            ringMenu.addIcon(container, 2 * 60, style.icons.iString, ringMenu.callbackIcon.bind({
                data: String(JSON.stringify(value)),
                target: this,
                container: container,
            }));
            ringMenu.addIcon(container, 3 * 60, style.icons.iObject, ringMenu.callbackIcon.bind({
                data: {},
                target: this,
                container: container,
            }));
            ringMenu.addIcon(container, 4 * 60, style.icons.iNumber, ringMenu.callbackIcon.bind({
                data: Number(value),
                target: this,
                container: container,
            }));
            ringMenu.addIcon(container, 5 * 60, style.icons.iBoolean, ringMenu.callbackIcon.bind({
                data: false,
                target: this,
                container: container,
            }));

            document.body.appendChild(container);

            evt.stopPropagation();
        },

        addIcon: function(container, angle, className, callback) {
            var rad = angle / 360 * Math.PI * 2;
            var i = document.createElement('i');
            i.className = className + ' knight-ringicon';
            i.style.position = 'absolute';

            // polar coords, substract half of the icon dimensions
            i.style.left = String(50 + 30 * Math.sin(rad) - 10) + 'px';
            i.style.top = String(50 + 30 * Math.cos(rad) - 10) + 'px';

            i.addEventListener('click', callback);
            container.appendChild(i);

        },

        callbackIcon: function(evt) {
            shim.remove(this.target);
            gen(this.data, this.target.knight_anchor);

            shim.remove(this.container.knight_cover);
            shim.remove(this.container);

            evt.stopPropagation();
        }
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
            target.knight_focus = element.knight_focus;
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
            this.className = 'fa fa-fw pull-right fa-chevron-down';
            this.knight_statehidden = false;
        },

        hide: function() {
            this.knight_target.style.display = 'none';
            this.className = 'fa fa-fw pull-right fa-chevron-right';
            this.knight_statehidden = true;
        },

        show_hide_toggle: function() {
            if (this.knight_statehidden) {
                formHelpers.show.bind(this)();
            } else {
                formHelpers.hide.bind(this)();
            }
        },

        callbackEat: function(evt) {
            evt.stopPropagation();
            evt.preventDefault();
        },

        focus: function() {
            this.focus();

            // align viewport at top+50px
            var rect = this.getBoundingClientRect();
            window.scrollBy(0, rect.top - 50);
        }
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
            i.className = style.icons.iArray;
            ringMenu.create(i, container);
            head.appendChild(i);

            // add button
            var plus = document.createElement('i');
            plus.className = style.icons.iAdd;
            plus.addEventListener('click', elementArray.modifyAdd.bind(container));
            head.appendChild(plus);

            // delete button
            var minus = document.createElement('i');
            minus.className = style.icons.iRemove;
            minus.addEventListener('click', elementArray.modifyDelete.bind(container));
            head.appendChild(minus);

            // counter
            var counter = document.createElement('span');
            container.knight_counter = counter;
            shim.textContentSet(counter, data.length);
            head.appendChild(counter);

            // show-hide toggle
            var toggle = document.createElement('i');
            toggle.knight_target = scrollhelper;
            head.addEventListener('click', formHelpers.show_hide_toggle.bind(toggle));
            head.appendChild(toggle);
            container.knight_show = formHelpers.show.bind(toggle);
            container.knight_hide = formHelpers.hide.bind(toggle);

            // array data
            for (var i = 0; i < data.length; ++i) {
                elementArray.genSub(data[i], container);
            }

            // initial state?
            if (container.knight_subs.length > 5) {
                formHelpers.hide.bind(toggle)();
            } else {
                formHelpers.show.bind(toggle)();
            }

            container.knight_focus = formHelpers.focus.bind(container);

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
            for (var i = 0; i < element.knight_subs.length; ++i) {
                var sub = element.knight_subs[i];
                result.push(sub.knight_value());
            }
            return result;
        },

        genSub: function(data, container) {
            var subcontainer = document.createElement('li');
            subcontainer.className = 'knight-arrayrow';
            gen(data, subcontainer);

            container.knight_body.appendChild(subcontainer);
            container.knight_subs.push(subcontainer);
        },

        modifyAdd: function(evt) {
            var container = this;

            // try to copy the last element
            var data = null;
            if (container.knight_subs.length > 0) {
                data = container.knight_subs[container.knight_subs.length - 1].knight_value();
            }

            elementArray.genSub(data, container);
            shim.textContentSet(container.knight_counter, container.knight_subs.length);

            evt.stopPropagation();
        },

        modifyDelete: function(evt) {
            var container = this;

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
                return null;
            } else {
                var head = tokens.shift();
                var index = parseInt(String(head).trim()) - 1;
                var element = null;
                var expanded = null;
                var score = 0;
                if (!isNaN(index) && index >= 0 && index < container.knight_subs.length) {
                    element = container.knight_subs[index];
                    expanded = String(index + 1);
                    score = container.knight_subs.length;
                }

                var result = [{
                    token: head,
                    expanded: expanded,
                    element: element,
                    score: score,
                }];

                if (element && element.knight_match) {
                    var sub = element.knight_match(tokens);
                    if (sub && sub[0]) {
                        result.score += sub[0].score;
                    }
                    result = result.concat(sub);
                }

                return result;
            }
        },
    };

    var elementBoolean = {
        gen: function(data, target) {
            var container = document.createElement('div');
            container.className = 'knight-boolean';

            var i = document.createElement('i');
            ringMenu.create(i, container);
            i.className = style.icons.iBoolean;

            var input = document.createElement('input');
            input.setAttribute('type', 'checkbox');

            formHelpers.create_ab(i, input, container);
            container.knight_value = elementBoolean.value.bind(input);
            container.knight_focus = formHelpers.focus.bind(input);

            input.checked = data;

            formHelpers.bindToAnchor(container, target);
        },

        value: function() {
            // get bind context
            var element = this;

            return element.checked;
        },
    };

    var elementNull = {
        gen: function(data, target) {
            var container = document.createElement('div');
            container.className = 'knight-null';

            var i = document.createElement('i');
            ringMenu.create(i, container);
            i.className = style.icons.iNull;

            var p = document.createElement('p');
            p.className = 'knight-null';
            p.innerHTML = 'null';

            formHelpers.create_ab(i, p, container);
            container.knight_value = elementNull.value;
            container.knight_focus = formHelpers.focus.bind(p);

            formHelpers.bindToAnchor(container, target);
        },

        value: function() {
            return null;
        },
    };

    var elementNumber = {
        gen: function(data, target) {
            var container = document.createElement('div');
            container.className = 'knight-number';

            var i = document.createElement('i');
            ringMenu.create(i, container);
            i.className = style.icons.iNumber;

            var input = document.createElement('input');
            input.setAttribute('type', 'number');

            formHelpers.create_ab(i, input, container);
            container.knight_value = elementNumber.value.bind(input);
            container.knight_focus = formHelpers.focus.bind(input);

            input.value = data;

            formHelpers.bindToAnchor(container, target);
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

            // head for metadata and buttons
            var head = document.createElement('div');
            head.className = 'knight-objecthead';

            // body for object content
            var body = document.createElement('div');
            body.className = 'knight-objectbody';
            container.knight_body = body;

            // type indicator
            var i = document.createElement('i');
            i.className = style.icons.iObject;
            ringMenu.create(i, container);
            head.appendChild(i);

            // add button
            var plus = document.createElement('i');
            plus.className = style.icons.iAdd;
            plus.addEventListener('click', elementObject.modifyAdd.bind(container));
            head.appendChild(plus);

            // delete button
            var minus = document.createElement('i');
            minus.className = style.icons.iRemove;
            minus.addEventListener('click', elementObject.modifyDelete.bind(container));
            head.appendChild(minus);

            // counter
            var counter = document.createElement('span');
            container.knight_counter = counter;
            shim.textContentSet(counter, keys.length);
            head.appendChild(counter);

            // show-hide toggle
            var toggle = document.createElement('i');
            toggle.knight_target = body;
            head.addEventListener('click', formHelpers.show_hide_toggle.bind(toggle));
            head.appendChild(toggle);
            container.knight_show = formHelpers.show.bind(toggle);
            container.knight_hide = formHelpers.hide.bind(toggle);

            // add content
            for (var i = 0; i < keys.length; ++i) {
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
            for (var i = 0; i < element.knight_subs.length; ++i) {
                var sub = element.knight_subs[i];
                result[sub.knight_key()] = sub.knight_value();
            }
            return result;
        },

        valueLabel: function() {
            // get bind context
            var element = this;

            // get text content without newline
            return shim.textContentGet(element).replace(/\n/g, '');
        },

        valueInput: function() {
            // get bind context
            var element = this;

            return element.knight_value();
        },

        genSub: function(k, v, container) {
            var subcontainer = document.createElement('div');
            subcontainer.className = 'knight-objectrow';

            var label = document.createElement('label');
            label.className = 'knight-label';
            label.setAttribute('contentEditable', true);
            shim.textContentSet(label, k);

            var input = document.createElement('div');
            input.className = 'knight-sub';
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

        modifyAdd: function(evt) {
            var container = this;

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

        modifyDelete: function(evt) {
            var container = this;

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
                return null;
            } else {
                var head = tokens.shift();
                var re = RegExp(String(head).trim(), 'i');
                var bestK = null;
                var bestV = null;
                var expanded = null;
                var score = 0;
                for (var i = 0; i < container.knight_subs.length; ++i) {
                    var k = container.knight_subs[i].knight_key();
                    var v = container.knight_subs[i].knight_input;
                    var m = re.exec(k);

                    // was it a match?
                    if (m) {
                        var next = m[0];
                        // was it better than the last one?
                        if (!expanded || next.length > score) {
                            expanded = next;
                            bestV = v;
                            bestK = k;
                            score = next.length;
                        }
                    }
                }

                var result = [{
                    token: head,
                    expanded: bestK,
                    element: bestV,
                }];

                if (bestV && bestV.knight_match) {
                    if (bestV && bestV.knight_match) {
                        var sub = bestV.knight_match(tokens);
                        if (sub && sub[0]) {
                            result.score += sub[0].score;
                        }
                        result = result.concat(sub);
                    }
                }

                return result;
            }
        },
    };

    var elementString = {
        gen: function(data, target) {
            var container = document.createElement('div');
            container.className = 'knight-string';

            var i = document.createElement('i');
            ringMenu.create(i, container);
            i.className = style.icons.iString;

            var input = document.createElement('p');
            input.setAttribute('contentEditable', true);

            formHelpers.create_ab(i, input, container);
            container.knight_value = elementString.value.bind(input);
            container.knight_focus = formHelpers.focus.bind(input);

            shim.textContentSet(input, data);

            formHelpers.bindToAnchor(container, target);
        },

        value: function() {
            // get bind context
            var element = this;

            return shim.textContentGet(element);
        },
    };

    var elementUnknown = {
        gen: function(data, target) {
            var container = document.createElement('div');
            container.className = 'knight-null';

            var i = document.createElement('i');
            i.className = 'fa fa-fw fa-question';

            var input = document.createElement('input');
            ringMenu.create(i, container);
            input.className = 'knight-unkown';

            formHelpers.create_ab(i, input, container);
            container.knight_value = elementUnknown.value.bind(input);
            container.knight_focus = formHelpers.focus.bind(input);

            input.value = data;

            formHelpers.bindToAnchor(container, target);
        },

        value: function() {
            // get bind context
            var element = this;

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
                for (var i = 0; i < element.childNodes.length; ++i) {
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
            for (var i = 0; i < parts.length; ++i) {
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
    };

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
            fragment_div.className = 'knight-main'
            fragment.appendChild(fragment_div);

            gen(json, fragment_div);

            // show outer element
            if (fragment_div.knight_show) {
                fragment_div.knight_show();
            }

            // initialize search
            searchBar.create(fragment_div);

            // add clearfix
            var clearfix = document.createElement('div');
            clearfix.className = 'clearfix knight-end';
            fragment.appendChild(clearfix);

            target.appendChild(fragment);
            $(loading).remove();
        });
    });
  });
})