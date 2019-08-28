/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var getTransform = require('../bar/plot').getTransform;

module.exports = function strTransform(d) {
    return getTransform({
        textX: d.transform.textX,
        textY: d.transform.textY,
        targetX: d.transform.targetX,
        targetY: d.transform.targetY,
        scale: d.transform.scale,
        rotate: d.transform.rotate
    });
};
