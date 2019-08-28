/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var Lib = require('../../lib');
var helpers = require('../sunburst/helpers');
var formatPieValue = require('../pie/helpers').formatPieValue;

module.exports = function formatSliceLabel(pt, entry, trace, fullLayout, opts) { // TODO: merge this & sunburst version into one function when texttemplate is merged
    var texttemplate = trace.texttemplate;
    var textinfo = trace.textinfo;

    if(!texttemplate && (!textinfo || textinfo === 'none')) {
        return '';
    }

    var cdi = pt.data.data;
    var separators = fullLayout.separators;
    if(!texttemplate) {
        var isInFront = helpers.isOnTop(pt, trace);

        var parts = textinfo.split('+');
        var hasFlag = function(flag) { return parts.indexOf(flag) !== -1; };
        var thisText = [];
        var tx;

        if(hasFlag('label') && cdi.label) {
            thisText.push(opts.label || cdi.label);
        }

        var hasV = cdi.hasOwnProperty('v');

        if(hasFlag('value')) {
            thisText.push(formatPieValue(hasV ? cdi.v : cdi.value, separators));
        }

        var nPercent = 0;
        if(hasFlag('percent parent')) nPercent++;
        if(hasFlag('percent total')) nPercent++;
        var hasMultiplePercents = nPercent > 1;

        if(nPercent) {
            var percent;
            var addPercent = function(key) {
                tx = Lib.formatPercent(percent, 0);
                if(tx === '0%') tx = Lib.formatPercent(percent, 1);
                if(tx !== '0.0%') {
                    if(hasMultiplePercents && isInFront) tx += ' of ' + key + ' ';
                    thisText.push(tx);
                }
            };

            var ref;
            var calcPercent = function(key) {
                percent = (hasV) ? cdi.v / ref.v : cdi.value / ref.value;
                addPercent(key);
            };

            if(hasFlag('percent parent') && pt.parent) {
                ref = pt.parent.data.data;
                calcPercent('parent');
            }
            if(hasFlag('percent total') && pt.parent) {
                ref = entry.data.data;
                calcPercent('total');
            }
        }

        if(!opts.noText && hasFlag('text')) {
            tx = Lib.castOption(trace, cdi.i, 'text');
            if(Lib.isValidTextValue(tx)) thisText.push(tx);
        }

        var divider = isInFront ? '<br>' : ' | ';
        return thisText.join(divider);
    }

    var txt = Lib.castOption(trace, cdi.i, 'texttemplate');
    if(!txt) return '';
    var obj = {};
    if(cdi.label) obj.label = cdi.label;
    if(cdi.hasOwnProperty('v')) {
        obj.value = cdi.v;
        obj.valueLabel = formatPieValue(cdi.v, separators);
    }
    if(cdi.hasOwnProperty('color')) {
        obj.color = cdi.color;
    }
    var ptTx = Lib.castOption(trace, cdi.i, 'text');
    if(Lib.isValidTextValue(ptTx)) obj.text = ptTx;
    obj.customdata = Lib.castOption(trace, cdi.i, 'customdata');
    return Lib.texttemplateString(txt, obj, fullLayout._d3locale, obj, trace._meta || {});
};
