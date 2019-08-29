/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

module.exports = function countDescendants(node, trace) {
    var descendants = 0;

    var children = node['child' + 'ren'];
    if(children) {
        var len = children.length;

        for(var i = 0; i < len; i++) {
            descendants += countDescendants(children[i], trace);
        }

        // count branch
        descendants += trace.countbranches;
    } else { // count leaf
        descendants += 1;
    }

    // save to the node
    node.value = node.data.data.value = descendants;

    // save to the trace
    if(!trace._values) trace._values = [];
    trace._values[node.data.data.i] = descendants;

    return descendants;
};
