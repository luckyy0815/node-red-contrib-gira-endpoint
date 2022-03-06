/*
 * node-red-contrib-gira-endpoint
 * Schnittstelle zum Homeserver
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
  'use strict';
//var GiraEndpointApi = require('./gira-endpoint-api.js');

    var ws = require("ws");
    var HttpsProxyAgent = require('https-proxy-agent');
    var base64 = require('base-64');
    var utf8 = require('utf8');

    // A node red node that sets up a local girahome server
    function GiraListenerNode(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);
        var node = this;

        // Store local copies of the node configuration (as defined in the .html)
        node.path = n.path;

        node.ssl =n.ssl;

        var text = this.credentials.username + ':' + this.credentials.password;
        var bytes = utf8.encode(text);
        var encoded = base64.encode(bytes);

        if (node.ssl) {
        node.path = 'ws://' + node.path + "/endpoints/ws?authorization=" + encoded;
         }
        else {
        node.path = 'ws://' + node.path + "/endpoints/ws?authorization=" + encoded;
        }
            node.subprotocol = [];


        node._inputNodes = [];    // collection of nodes that want to receive events
        node._clients = {};
        // match absolute url
        node.closing = false;
        node.tls = n.tls;

        function startconn() {    // Connect to remote endpoint
            node.tout = null;
            var prox, noprox;
            if (process.env.http_proxy) { prox = process.env.http_proxy; }
            if (process.env.HTTP_PROXY) { prox = process.env.HTTP_PROXY; }
            if (process.env.no_proxy) { noprox = process.env.no_proxy.split(","); }
            if (process.env.NO_PROXY) { noprox = process.env.NO_PROXY.split(","); }

            var noproxy = false;
            if (noprox) {
                for (var i in noprox) {
                    if (node.path.indexOf(noprox[i].trim()) !== -1) { noproxy=true; }
                }
            }

            var agent = undefined;
            if (prox && !noproxy) {
                agent = new HttpsProxyAgent(prox);
            }

            var options = {};
            if (agent) {
                options.agent = agent;
            }
            if (node.tls) {
                var tlsNode = RED.nodes.getNode(node.tls);
                if (tlsNode) {
                    tlsNode.addTLSOptions(options);
                }
            }
            var socket = new ws(node.path,node.subprotocol,options);
            socket.setMaxListeners(0);
            node.server = socket; // keep for closing
            handleConnection(socket);

        }

        function handleConnection(/*socket*/socket) {
            var id = RED.util.generateId();
            socket.nrId = id;

            socket.on('open',function() {
                    node.emit('opened',{count:'',id:id});
             });
            socket.on('close',function() {
                    node.emit('closed',{count:'',id:id});

                if (!node.closing) {
                    clearTimeout(node.tout);
                    node.tout = setTimeout(function() { startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
                }
            });
            socket.on('message',function(data,flags) { // aktiv beim empfangen von Nachrichten
            // zuerst angekommen da zu handleevent
            if (data.includes('request')) {
             //    node.handleRequest(id,socket,'message',data,flags);
            }
            else {
                node.handleEvent(id,socket,'message',data,flags);
                }
            });


            socket.nrErrorHandler = function(err) {
                node.emit('erro',{err:err,id:id});
                if (!node.closing ) {
                    clearTimeout(node.tout);
                    node.tout = setTimeout(function() { startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
                }
            }
            socket.on('error',socket.nrErrorHandler);
        }


            node.closing = false;
            startconn(); // start outbound connection
         node.on('opened',function() {
                    setTimeout(function() { node.Registration();}, 3000);
             });

        node.on("close", function() {
                node.closing = true;
                node.server.close();
                if (node.tout) {
                    clearTimeout(node.tout);
                    node.tout = null;
                }
        });
    }
     RED.nodes.registerType("gira-home",GiraListenerNode,  {
        credentials: {
            username: { type: 'text' },
            password: { type: 'password' }
        }
    });

    GiraListenerNode.prototype.registerInputNode = function(/*Node*/handler) {
        this._inputNodes.push(handler);
   //     this.handleReg(handler.id,handler.endpoint);
     }

    GiraListenerNode.prototype.removeInputNode = function(/*Node*/handler) {
        this._inputNodes.forEach(function(node, i, inputNodes) {
            if (node === handler) {
                inputNodes.splice(i, 1);
            }
        });
     //    this.handledeReg(handler.id,handler.endpoint);
    }



    // wird ausgeführt nach dem die Nachricht empfangen wurde als handler
    GiraListenerNode.prototype.handleEvent = function(id,/*socket*/socket,/*String*/event,/*Object*/data,/*Object*/flags) {
        var msg;
        var TFmsg;
        var uuidKey;
        var uuidValue;
          msg = {
                payload:JSON.parse(data)  //  payload:JSON.parse(data)
            };
        msg._session = {type:"girain",id:id};
        try {
        uuidValue = msg.payload.data.value;
        } catch(err) {
         uuidValue = null;
        }
        try {
        uuidKey = msg.payload.subscription.key;
        } catch(err) {
        uuidKey = null;
        }
       if (uuidValue == 1) uuidValue = true;
       if (uuidValue == 0) uuidValue = false;

        if (isNaN(uuidValue) && uuidKey != null){
                uuidValue = base64.decode(uuidValue);
                uuidValue = utf8.decode(uuidValue);
        }

        for (var i = 0; i < this._inputNodes.length; i++) {
        if ( this._inputNodes[i].allendpoints ||   this._inputNodes[i].endpoint.includes(',') && UidCheck(this._inputNodes[i].endpoint, uuidKey)) {         //  if ( this._inputNodes[i].endpoint === uuidKey || this._inputNodes[i].allendpoints) {
            this._inputNodes[i].send(msg);
            }
            else if ( this._inputNodes[i].endpoint == uuidKey) {
                TFmsg = msg;
                TFmsg = { payload:uuidValue};
                this._inputNodes[i].send(TFmsg);
            }
        }
}

    GiraListenerNode.prototype.handleRequest = function(id,/*socket*/socket,/*String*/event,/*Object*/data,/*Object*/flags) {
    var msg;
    var request;
    request = JSON.parse(data);
   if (data.includes('subscribe')) {

     for (var i = 0; i < request.data.items.length; i++) {
        msg = {
                request: request.data.items[i]
                 };
     msg._session = {type:"girain",id:id};
     msg.payload = {};
            for (var m = 0; m < this._inputNodes.length; m++) {
                if ( this._inputNodes[m].allendpoints || UidCheck(this._inputNodes[m].endpoint, request.data.items[i].key) ) {
                this._inputNodes[m].send(msg);
                }
           }
        }
 }
  else {
          msg = {
                request: request
                 };
     msg._session = {type:"girain",id:id};
     msg.payload = {};
            for (var m = 0; m < this._inputNodes.length; m++) {
                if ( this._inputNodes[m].allendpoints || UidCheck(this._inputNodes[m].endpoint, request.request.key) ) {
                this._inputNodes[m].send(msg);
                }
           }

  }
 }
    // Check ob key vorhanden
    function UidCheck(endKey, uuidKey) {
    var endKeyValue;
    endKeyValue = (endKey.replace(/\s/gi,'')).split(',');
        if ( endKeyValue.includes(uuidKey)) return true;
    }

    GiraListenerNode.prototype.broadcast = function(data) {
         try {
                this.server.send(data);
            } catch(err) {
                this.warn(RED._("girahome.errors.send-error")+" "+err.toString())
            }

   }

    GiraListenerNode.prototype.handleReg = function(uidid,uidAdr) {
    var payload;

     payload =  {"type":"subscribe","param":{"keys":[uidAdr]}};
            //    payload:JSON.parse(data)  //  payload:JSON.parse(data)
            this.broadcast(JSON.stringify(payload));
    //  this.broadcast(payload);

    }

     GiraListenerNode.prototype.handledeReg = function(uidid,uidAdr) {
     var payload;
     payload =  {"type":"unsubscribe","param":{"keys":[uidAdr]}};
            //    payload:JSON.parse(data)  //  payload:JSON.parse(data)
      this.broadcast(JSON.stringify(payload));

    }

  GiraListenerNode.prototype.Registration = function() {
     var payload;
     var uidAdr;

   for (var i = 0; i < this._inputNodes.length; i++) {
   uidAdr = this._inputNodes[i].endpoint;

  if (uidAdr.startsWith('CO@') && !uidAdr.includes(',')) {
   payload =  {"type":"subscribe","param":{"keys":[uidAdr]}};
     this.broadcast(JSON.stringify(payload));
  }
    if (uidAdr.includes(',')){
        uidAdr = (uidAdr.replace(/\s/gi,'')).split(',');
        payload =  {"type":"subscribe","param":{"keys":uidAdr}};
     this.broadcast(JSON.stringify(payload));

    }
      // console.log('Payload Start ', JSON.stringify(payload));
        }
  }
 // JSON.stringify
 // {"type":"subscribe","param":{"keys":["CO@2_0_0","CO@6_3_9","CO@2_1_14","CO@2_6_14","CO@7_7_2","CO@7_7_13"]}}
  }

