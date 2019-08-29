/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var Lib = require('../../lib');
var formatPieValue = require('../pie/helpers').formatPieValue;

module.exports = function formatSliceLabel(pt, trace, fullLayout) {
    var texttemplate = trace.texttemplate;
    var textinfo = trace.textinfo;

    if(!texttemplate && (!textinfo || textinfo === 'none')) {
        return '';
    }

    var cdi = pt.data.data;
    var separators = fullLayout.separators;
    if(!texttemplate) {
        var parts = textinfo.split('+');
        var hasFlag = function(flag) { return parts.indexOf(flag) !== -1; };
        var thisText = [];

        if(hasFlag('label') && cdi.label) {
            thisText.push(cdi.label);
        }

        if(cdi.hasOwnProperty('v') && hasFlag('value')) {
            thisText.push(formatPieValue(cdi.v, separators));
        }

        if(hasFlag('text')) {
            var tx = Lib.castOption(trace, cdi.i, 'text');
            if(Lib.isValidTextValue(tx)) thisText.push(tx);
        }

        return thisText.join('<br>');
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
