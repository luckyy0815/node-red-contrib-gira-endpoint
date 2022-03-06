/*
 * node-red-contrib-endpoint
 * Senden an den Homeserver
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

module.exports = function (RED) {
	  "use strict";
    var ws = require("ws");
    var inspect = require("util").inspect;
    var base64 = require('base-64');
    var utf8 = require('utf8');

    function GiraOutNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        this.server = n.client;

        node.endpoint = n.endpoint; // adresse Eingang
        node.allendpoints = n.allendpoints; // alle adressen

       this.serverConfig = RED.nodes.getNode(this.server);

        if (!this.serverConfig) {
            return this.error(RED._("girahome.errors.missing-conf"));
        }
        else {
            // TODO: nls
            this.serverConfig.on('opened', function(event) {
                node.status({
                    fill:"green",shape:"dot",text:RED._("Verbunden",{count:event.count}),
                    event:"connect",
                    _session: {type:"giraout",id:event.id}
                 });
            });
            this.serverConfig.on('erro', function(event) {
                node.status({
                    fill:"red",shape:"ring",text:"Fehler",
                    event:"error",
                    _session: {type:"giraout",id:event.id}
                })
            });
            this.serverConfig.on('closed', function(event) {
                var status;
                if (event.count > 0) {
                    status = {fill:"green",shape:"dot",text:RED._("Verbunden",{count:event.count})};
                } else {
                    status = {fill:"red",shape:"ring",text:"Verbindung getrennt"};
                }
                status.event = "disconnect";
                status._session = {type:"giraout",id:event.id}
                node.status(status);
            });
        }
        this.on("input", function(msg, nodeSend, nodeDone) {
            var payload;
            var uidValue;
            var method = "set";
            if (node.allendpoints) {
             }
            else {
                if (isNaN(msg.payload)){
                     uidValue = msg.payload;
                      if (msg.payload === 'false' || msg.payload === 'true' ) {
                          if (msg.payload === 'true' ) uidValue = '1';
                          else {
                            uidValue = '0';
                            } }
                      else if (msg.payload === 'toggle') {
                                                    uidValue = '1';
                                                    method = "toggle";
                                                 }
                       else {
                       uidValue = utf8.encode(msg.payload);
                       uidValue = base64.encode(uidValue);
                         }
                              }
                else {
                     uidValue = msg.payload;
                     }
  msg.payload = {"type":"call","param":{"key":node.endpoint,"method":method,"value":uidValue}};
  msg.payload = JSON.stringify(msg.payload);
            }
            if (msg.hasOwnProperty("payload")) {
               if (!Buffer.isBuffer(msg.payload)) { // if it's not a buffer make sure it's a string.
                    payload = RED.util.ensureString(msg.payload);
                }
                else {
                      payload = msg.payload;
                }
            }
            if (payload) {
                    node.serverConfig.broadcast(payload,function(error) {
                        if (!!error) {
                            node.warn(RED._("girahome.errors.send-error")+inspect(error));
                        }
                    });
            }
            nodeDone();
        });
        this.on('close', function() {
            node.status({});
        });
    }
    RED.nodes.registerType("gira-out",GiraOutNode);

    }

