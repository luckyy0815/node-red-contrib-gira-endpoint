/*
 * node-red-contrib-gira-endpoint
 * Empfangem vom Homeserver
 * Copyright (C) 2022 Markus Luck
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 'use strict';
 */

// const { denodeify } = require('q');

module.exports = function (RED) {
	  "use strict";
    var ws = require("ws");

     function GiraInNode(n) {
        RED.nodes.createNode(this,n);
        this.server = n.client; //  this.server = (n.client)?n.client:n.server;
        var node = this;

        node.endpoint = n.endpoint; // adresse
        node.allendpoints = n.allendpoints; // alle adressen

        this.serverConfig = RED.nodes.getNode(this.server);
        if (this.serverConfig) {
            this.serverConfig.registerInputNode(this);
            // TODO: nls
            this.serverConfig.on('opened', function(event) {
                node.status({
                    fill:"green",shape:"dot",text:RED._("Verbunden",{count:event.count}),
                    event:"connect",
                    _session: {type:"girain",id:event.id}
                });
            });
            this.serverConfig.on('erro', function(event) {
                node.status({
                    fill:"red",shape:"ring",text:"Fehler",
                    event:"error",
                    _session: {type:"girain",id:event.id}
                });
            });
            this.serverConfig.on('closed', function(event) {
                var status;
                if (event.count > 0) {
                    status = {fill:"green",shape:"dot",text:RED._("Verbunden",{count:event.count})};
                } else {
                    status = {fill:"red",shape:"ring",text:"Verbindung getrennt"};
                }
                status.event = "disconnect";
                status._session = {type:"girain",id:event.id}
                node.status(status);
            });
        } else {
            this.error(RED._("girahome.errors.missing-conf"));
        }
        this.on('close', function() {
            if (node.serverConfig) {
                node.serverConfig.removeInputNode(node);
            }
            node.status({});
        });
    }
    RED.nodes.registerType("gira-in",GiraInNode)

    }
