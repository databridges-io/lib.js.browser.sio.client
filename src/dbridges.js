/* eslint-disable no-async-promise-executor */
/* eslint-disable no-undef */
/* eslint-disable linebreak-style */

/*
	DataBridges JavaScript client Library for browsers
	https://www.databridges.io/



	Copyright 2022 Optomate Technologies Private Limited.

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	    http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/


"use strict";
import { ConnectionState } from "./Connection/ConectionState.js";
import { Channels } from "./channel/channels.js";
import { states } from "./Connection/states.js";
import { MessageTypes } from "./msgTypes/dBMessageTypes.js";
import { channelStatus } from "./channel/channelstatus.js";
import { dispatcher } from "./dispatcher/dispatcher.js";
import { Crpcclient } from "./rpc/rpcclient.js";
import { CRpc } from "./rpc/rpc.js";
import { rpcStatus } from "./rpc/rpcstatus.js";
import { dBError } from "./exception/errorMessages.js";



export class dBridges {


  constructor() {
    this.appkey = undefined;
    this.auth_url = undefined;
    this._count = 0;
    this._metadata = {
      "channelname": undefined,
      "eventname": undefined,
      "sourcesysid": undefined,
      "sqnum": undefined,
      "sessionid": undefined,
      "intime": undefined,
    };
    this._ClientSocket = undefined;
    this._sessionid = undefined;
    this.connectionstate = new ConnectionState(this);
    this.channel = new Channels(this);
    this._options = {};
    
    this.maxReconnectionRetries = 10;
    this.maxReconnectionDelay = 120000;
    this.minReconnectionDelay = 1000 + Math.random() * 4000;
    this.reconnectionDelayGrowFactor = 1.3;
    this.minUptime = 500;
    this.connectionTimeout = 10000;
    this.autoReconnect = true;

    this._uptimeTimeout = undefined;
    this._retryCount = 0;
    
    this._lifeCycle = 0;
    this._isServerReconnect = false;
    this._disconnect_reason="";
    this._dispatch = new dispatcher();
    this.cf = new Crpcclient(this);
    this.rpc = new CRpc(this);
  }

  get sessionid() {
    return this._sessionid;
  }


  access_token(callback) {
    if (!(callback)) throw (new dBError("E004"));
    if (!(typeof callback === "function")) throw (new dBError("E004"));

    if (!this._dispatch.isExists("dbridges:access_token")) {
      this._dispatch.bind("dbridges:access_token", callback);
    } else {
      throw (new dBError("E004"));
    }
  }


  _accesstoken_dispatcher(channelName, action, response) {
    if (this._dispatch.isExists("dbridges:access_token")) {
      this._dispatch.emit2("dbridges:access_token", channelName, this._sessionid, action, response);
    } else {
      throw (new dBError("E004"));
    }
  }






  _acceptOpen() {
    this._retryCount = 0;
    this.connectionstate.reconnect_attempt = this._retryCount;
    if (this._ClientSocket.connected) {
      if (this._lifeCycle == 0) {
        this.connectionstate._handledispatcher(states.CONNECTED);
        this._lifeCycle++;
      } else {
        this.connectionstate._handledispatcher(states.RECONNECTED);
      }
    }
  }

    _getNextDelay = () => {
      let delay = 0;
      if (this._retryCount > 0) {
        delay =
                this.minReconnectionDelay * Math.pow(this.reconnectionDelayGrowFactor, this._retryCount - 1);
        delay = (delay > this.maxReconnectionDelay) ? this.maxReconnectionDelay : delay;
        delay = (delay < this.minReconnectionDelay) ? this.minReconnectionDelay : delay;
      }
      return delay;
    }

    _wait() {
      return new Promise(resolve => {
        setTimeout(resolve, this._getNextDelay());
      });
    }


    _reconnect = async () => {

      if (this._retryCount >= this.maxReconnectionRetries) {
        this.connectionstate._handledispatcher(states.RECONNECT_FAILED, new dBError("E060"));
        
        if (this._ClientSocket) this._ClientSocket.removeAllListeners();
        this.channel.cleanUp_All();
        this.rpc.cleanUp_All();
        //this.connectionstate.state = "";
        this._lifeCycle =  0;
        this._retryCount = 0;
        this.connectionstate.set_newLifeCycle(true);
        this.connectionstate._handledispatcher(states.DISCONNECTED);
        return;
      }
      this._retryCount++;
      this._wait()
        .then(() => {
          this.connectionstate.reconnect_attempt = this._retryCount;
          this.connectionstate._handledispatcher(states.RECONNECTING, {});
          this.connect();
        });
    }

    shouldRestart(ekey) {
      if (this.autoReconnect) {
        if (!this.connectionstate.get_newLifeCycle()) {
          if (typeof ekey === "string") {
            this.connectionstate._handledispatcher(states.RECONNECT_ERROR, new dBError(ekey));
          } else {
            this.connectionstate._handledispatcher(states.RECONNECT_ERROR, ekey);
          }
          this._reconnect();
          return;
        } else {
          if (typeof ekey === "string") {
            this.connectionstate._handledispatcher(states.ERROR, new dBError(ekey));
          } else {
            this.connectionstate._handledispatcher(states.ERROR, ekey);
          }
          return;
        }
      }
    }

    disconnect() {
      this._ClientSocket.disconnect();
    }



    connect = async () => {

      if(this._retryCount == 0  && !this.connectionstate.get_newLifeCycle())
      {
        this.connectionstate.set_newLifeCycle(true);
      }
      
      if (!this.auth_url) {
        if (this.connectionstate.get_newLifeCycle()) {
          throw (new dBError("E001"));
        } else {
          this.shouldRestart("E001");
          return;
        }
      }



      if (!this.appkey) {

        if (this.connectionstate.get_newLifeCycle()) {
          throw (new dBError("E002"));
        } else {
          this.shouldRestart("E002");
          return;

        }
      }



      try {
        this.cf._verify_function();
      } catch (error) {
        if (this.connectionstate.get_newLifeCycle()) {
          throw (error);
        } else {
          this.shouldRestart(error);
          return;
        }
      }

      let jdata = undefined;
      try {
        jdata = await this.GetdBRInfo(this.auth_url, this.appkey);
      } catch (error) {
        if (this.connectionstate.get_newLifeCycle()) {
          throw (error);
        } else {
          this.shouldRestart(error);
          return;

        }
      }

      if (!jdata) {

        this.shouldRestart("E008", [this.auth_url]);
        return;
      }


      let secure = jdata.secured;

      let protocol = (secure) ? "https://" : "http://";
      let dbripport = protocol + jdata.wsip + ":" + jdata.wsport;


      this._options["query"] = {
        "sessionkey": jdata.sessionkey,
        "version": "1.1",
        "libtype": "javascript",
        "cf": this.cf.enable
      };

      this._options.secure = !("secure" in this._options) ? true : true;
      this._options.rejectUnauthorized = !("rejectUnauthorized" in this._options) ? false : false;

      this._options.retryInterval = !("retryInterval" in this._options) ? 5 : 5;
      this._options.retryAttempt = !("retryAttempt" in this._options) ? 0 : 0;
      this._options.reconnect = !("reconnect" in this._options) ? false : false;

      this._options["transports"] = ["websocket"];
      this._options["timeout"] = (this.connectionTimeout <= 0) ? 20000 : this.connectionTimeout;

      if (this._lifeCycle == 0) {
        this.connectionstate._handledispatcher(states.CONNECTING, {});
      }
      this._isServerReconnect = false;
      this._disconnect_reason = "";
      this.connectionstate.set_newLifeCycle(true);

      // try{
      this._ClientSocket = io.connect(dbripport, this._options);
      this._ClientSocket.addEventListener("disconnect", this._IOEventReconnect);
      this._ClientSocket.addEventListener("db", this._IOMessage);
      this._ClientSocket.addEventListener("connect", this._IOConnect);
      this._ClientSocket.addEventListener("connect_timeout", this._IOConnectFailed);
      this._ClientSocket.addEventListener("connect_error", this._IOError);
      window.addEventListener("offline" ,  ()=>{
        //this._IOEventReconnect("navigator.offline");
        this._isServerReconnect =  true;
        this._disconnect_reason = "navigator.offline";
        this._ClientSocket.disconnect();
      });
      //}catch(error){
      //  throw error;
      // }
    }



    GetdBRInfo = (url, api_key) => {
      return new Promise(async (resolve, reject) => {

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": api_key,
              "lib-transport": "sio",
            },
            agent: this.httpsAgent,
            body: "{}"
          });
          if (response.status != 200) {
            let db = new dBError("E006", [response.status, response.statusText]);
            db.updatecode(response.status, "");
            reject(db);
          }
          let jdata = await response.json();
          resolve(jdata);

        } catch (error) {
          let db = new dBError("E008", [error.code, error.message]);
          db.updatecode(error.code, "");
          reject(db);
        }
      });
    }

    _IOEventReconnect = (reason) => {
      this.channel._send_OfflineEvents();
      this.rpc._send_OfflineEvents();
      switch (reason) {
      case "io server disconnect":
        this.connectionstate._handledispatcher(states.ERROR, new dBError("E061"));
        if (this._ClientSocket) this._ClientSocket.removeAllListeners();
        if (!this.autoReconnect) {
          
          this.channel.cleanUp_All();
          this.rpc.cleanUp_All();
          //this.connectionstate.state = "";
          this._lifeCycle =  0;
          this._retryCount = 0;
          this.connectionstate.set_newLifeCycle(true);
          this.connectionstate._handledispatcher(states.DISCONNECTED);
        }else{
          this._reconnect();
        }

        break;
      case "io client disconnect":
        if (this._isServerReconnect) {

          if(this._disconnect_reason == "navigator.offline"){
            let dberr = new dBError("E063");
            dberr.updatecode(null, "BROWSER_NAVIGATOR_OFFLINE");
            this.connectionstate._handledispatcher(states.CONNECTION_BREAK, dberr);
            
          }else{
            this.connectionstate._handledispatcher(states.CONNECTION_BREAK, new dBError("E062"));
          }
          
          if (this._ClientSocket) this._ClientSocket.removeAllListeners();
          if (!this.autoReconnect) {
            
            this.channel.cleanUp_All();
            this.rpc.cleanUp_All();
            //this.connectionstate.state = "";
            this._lifeCycle =  0;
            this._retryCount = 0;
            this.connectionstate.set_newLifeCycle(true);
            this.connectionstate._handledispatcher(states.DISCONNECTED);
          }else{
            this._reconnect();
          }

        } else {
          //this.connectionstate._handledispatcher(states.ERROR, new dBError("E063"));
          
          if (this._ClientSocket) this._ClientSocket.removeAllListeners();
          this.channel.cleanUp_All();
          this.rpc.cleanUp_All();
          //this.connectionstate.state = "";
          this._lifeCycle =  0;
          this._retryCount = 0;
          this.connectionstate.set_newLifeCycle(true);
          this.connectionstate._handledispatcher(states.DISCONNECTED );
        }

        break;

      default:
        if (this._uptimeTimeout) clearTimeout(this._uptimeTimeout);

        this.connectionstate._handledispatcher(states.CONNECTION_BREAK, new dBError("E063"));
        if (this._ClientSocket) this._ClientSocket.removeAllListeners();
        if (!this.autoReconnect) {
         
          this.channel.cleanUp_All();
          this.rpc.cleanUp_All();
          //this.connectionstate.state = "";
          this._lifeCycle =  0;
          this._retryCount = 0;
          this.connectionstate.set_newLifeCycle(true);
          this.connectionstate._handledispatcher(states.DISCONNECTED);
        }else{
          this._reconnect();
        }
        break;

      }

    }


    _ReplyLatency = (recdlatency, oqueumonitorid) => {
      if (this._ClientSocket.connected) {
        this._ClientSocket.emit("db", MessageTypes.LATENCY, null, null, null, null, null, null, null, null, null, recdlatency, null, null, null, true, oqueumonitorid);
      }
    }


    _Rttpong = (dbmsgtype, subject, rsub, sid, payload, fenceid,
      rspend, rtrack, rtrackstat, t1, latency, globmatch,
      sourceid, sourceip, replylatency, oqueumonitorid) => {
      if (this._ClientSocket.connected) {
        this._ClientSocket.emit("db", dbmsgtype, subject, rsub, sid, payload, fenceid,
          rspend, rtrack, rtrackstat, t1, latency, globmatch,
          sourceid, sourceip, replylatency, oqueumonitorid);
      }
    }




    _mBufferToString = (buffer) => {
      if (buffer) {
        const decoder = new TextDecoder();
        return decoder.decode(buffer);
      }
      return "";
    }


    _IOMessage = (dbmsgtype, subject, rsub, sid, payload, fenceid,
      rspend, rtrack, rtrackstat, t1, latency, globmatch,
      sourceid, sourceip, replylatency, oqueumonitorid) => {

      let mchannelName = undefined;
      let metadata = undefined;
      const recieved = new Date().getTime(); 
      let recdDate = (t1) ? Number(t1) : 0;
      const lib_latency = recieved - recdDate;
      
      let dberr = undefined;
      let rpccaller = undefined;
      let extradata = undefined;
      let mpayload = undefined;
      
      switch (dbmsgtype) {

      case MessageTypes.SYSTEM_MSG:
        switch (subject) {
        case "connection:success":
          this._sessionid = this._mBufferToString(payload);

          if (this.connectionstate.get_newLifeCycle()) {
            if (this.cf.enable) {
              this.cf.functions(); //executing 
            }
          }

          this.connectionstate.set_newLifeCycle(false);
          this._uptimeTimeout = setTimeout(() => this._acceptOpen(), (this.minUptime < 0) ? 5000 : this.minUptime);
          
          this.rpc._ReSubscribeAll();
          this.channel._ReSubscribeAll();

          if (t1) {
            this._Rttpong(dbmsgtype, "rttpong", rsub, sid, payload, fenceid,
              rspend, rtrack, rtrackstat, t1, lib_latency, globmatch,
              sourceid, sourceip, replylatency, oqueumonitorid);
          }


          break;

        case "rttping":

          if (t1) {
            this.connectionstate._rttms = lib_latency;

            this._Rttpong(dbmsgtype, "rttpong", rsub, sid, payload, fenceid,
              rspend, rtrack, rtrackstat, t1, lib_latency, globmatch,
              sourceid, sourceip, replylatency, oqueumonitorid);
          }

          break;

        case "rttpong":
          if (t1) {
            const now = new Date();
            const eventData = now.getTime() - Number(t1);
            this.connectionstate._rttms = lib_latency;
            this.connectionstate._handledispatcher(states.RTTPONG, eventData);
          }
          break;
        case "reconnect":
          // nned to check 
          this._isServerReconnect = true;
          this._ClientSocket.disconnect();
          break;

        default: //fail:access_denied fail:error
          dberr = new dBError("E082");
          dberr.updatecode(subject, this._mBufferToString(payload));
          this.connectionstate._handledispatcher(states.ERROR, dberr);
          break;
        }

        break;
      case MessageTypes.SUBSCRIBE_TO_CHANNEL:
        switch (subject) {
        case "success":
          switch (this.channel._get_subscribeStatus(sid)) {
          case channelStatus.SUBSCRIPTION_INITIATED:
            this.channel._updateChannelsStatusAddChange(0, sid, channelStatus.SUBSCRIPTION_ACCEPTED, "");
            break;
          case channelStatus.SUBSCRIPTION_ACCEPTED:
          case channelStatus.SUBSCRIPTION_PENDING:
            this.channel._updateChannelsStatusAddChange(1, sid, channelStatus.SUBSCRIPTION_ACCEPTED, "");
            break;
          }
          break;
        default: //fail:access_denied fail:error
          dberr = new dBError("E064");
          dberr.updatecode(subject.toUpperCase(), this._mBufferToString(payload));

          switch (this.channel._get_subscribeStatus(sid)) {
          case channelStatus.SUBSCRIPTION_INITIATED:
            this.channel._updateChannelsStatusAddChange(0, sid, channelStatus.SUBSCRIPTION_ERRORs, dberr);
            break;
          case channelStatus.SUBSCRIPTION_ACCEPTED:
          case channelStatus.SUBSCRIPTION_PENDING:
            this.channel._updateChannelsStatusAddChange(1, sid, channelStatus.SUBSCRIPTION_PENDING, dberr);
            break;
          }
          break;
        }
        break;
      case MessageTypes.CONNECT_TO_CHANNEL:
        switch (subject) {
        case "success":

          switch (this.channel._get_subscribeStatus(sid)) {
          case channelStatus.CONNECTION_INITIATED:
            this.channel._updateChannelsStatusAddChange(0, sid, channelStatus.CONNECTION_ACCEPTED, "");
            break;
          case channelStatus.CONNECTION_ACCEPTED:
          case channelStatus.CONNECTION_PENDING:
            this.channel._updateChannelsStatusAddChange(1, sid, channelStatus.CONNECTION_ACCEPTED, "");
            break;
          }
          break;
        default: //fail:access_denied fail:error 
          dberr = new dBError("E084");
          dberr.updatecode(subject.toUpperCase(), this._mBufferToString(payload));

          switch (this.channel._get_subscribeStatus(sid)) {
          case channelStatus.CONNECTION_INITIATED:
            this.channel._updateChannelsStatusAddChange(0, sid, channelStatus.CONNECTION_ERROR, dberr);
            break;
          case channelStatus.CONNECTION_ACCEPTED:
          case channelStatus.CONNECTION_PENDING:
            this.channel._updateChannelsStatusAddChange(1, sid, channelStatus.CONNECTION_PENDING, dberr);
            break;
          }
          break;
        }
        break;
      case MessageTypes.UNSUBSCRIBE_DISCONNECT_FROM_CHANNEL:
        switch (subject) {
        case "success":

          switch (this.channel._get_channelType(sid)) {
          case "s":
            this.channel._updateChannelsStatusRemove(sid, channelStatus.UNSUBSCRIBE_ACCEPTED, "");
            break;
          case "c":
            this.channel._updateChannelsStatusRemove(sid, channelStatus.DISCONNECT_ACCEPTED, "");
            break;
          }
          break;
        default: //fail:error
          switch (this.channel._get_channelType(sid)) {
          case "s":
            dberr = new dBError("E065");
            dberr.updatecode(subject.toUpperCase(), this._mBufferToString(payload));

            this.channel._updateChannelsStatusRemove(sid, channelStatus.UNSUBSCRIBE_ERROR, dberr);
            break;
          case "c":
            dberr = new dBError("E088");
            dberr.updatecode(subject.toUpperCase(), this._mBufferToString(payload));
            this.channel._updateChannelsStatusRemove(sid, channelStatus.DISCONNECT_ERROR, "");
            break;
          }
          break;
        }
        break;

      case MessageTypes.PUBLISH_TO_CHANNEL:
        mchannelName = this.channel._get_channelName(sid);
        metadata = Object.assign({}, this._metadata);
        metadata.eventname = subject;
        metadata.sourcesysid = sourceid;
        metadata.sessionid = sourceip;
        metadata.sqnum = oqueumonitorid;
        if (t1) { metadata.intime = t1; }


        if (mchannelName.toLowerCase().startsWith("sys:*")) {
          metadata.channelname = fenceid;
        } else {
          metadata.channelname = mchannelName;
        }

        mpayload = undefined;
        try {
          mpayload = (payload) ? this._mBufferToString(payload) : "";
        } catch (error) {
          mpayload = "";
        }

        this.channel._handledispatcherEvents(subject, mpayload, mchannelName, metadata);

        break;
      case MessageTypes.PARTICIPANT_JOIN:
        mchannelName = this.channel._get_channelName(sid);
        metadata = Object.assign({}, this._metadata);
        metadata.eventname = "dbridges:participant.joined";
        metadata.sourcesysid = sourceid;
        metadata.sessionid = sourceip;
        metadata.sqnum = oqueumonitorid;
        metadata.channelname = mchannelName;
        if (t1) { metadata.intime = t1; }

        if (mchannelName.toLowerCase().startsWith("sys:") || mchannelName.toLowerCase().startsWith("prs:")) {
          extradata = this._convertToObject(sourceip, sourceid, fenceid);
          metadata.sourcesysid = extradata.sysyid;
          metadata.sessionid = extradata.s;
          if (mchannelName.toLowerCase().startsWith("sys::*")) {
            this.channel._handledispatcherEvents("dbridges:participant.joined", extradata.i, mchannelName, metadata);
          } else {
            this.channel._handledispatcherEvents("dbridges:participant.joined", extradata.i, mchannelName, metadata);
          }
        } else {
          this.channel._handledispatcherEvents("dbridges:participant.joined", { "sourcesysid": sourceid }, mchannelName, metadata);
        }

        break;

      case MessageTypes.PARTICIPANT_LEFT:
        mchannelName = this.channel._get_channelName(sid);

        metadata = Object.assign({}, this._metadata);
        metadata.eventname = "dbridges:participant.left";
        metadata.sourcesysid = sourceid;
        metadata.sessionid = sourceip;
        metadata.sqnum = oqueumonitorid;
        metadata.channelname = mchannelName;
        if (t1) { metadata.intime = t1; }
        if (mchannelName.toLowerCase().startsWith("sys:") || mchannelName.toLowerCase().startsWith("prs:")) {
          extradata = this._convertToObject(sourceip, sourceid, fenceid);
          metadata.sourcesysid = extradata.sysyid;
          metadata.sessionid = extradata.s;
          
          if (mchannelName.toLowerCase().startsWith("sys:*")) {
            
            //metadata.sessionid = extradata.s;

            this.channel._handledispatcherEvents("dbridges:participant.left", extradata.i, mchannelName, metadata);
          } else {
            this.channel._handledispatcherEvents("dbridges:participant.left", extradata.i, mchannelName, metadata);
          }
        } else {
          this.channel._handledispatcherEvents("dbridges:participant.left", { "sourcesysid": sourceid }, mchannelName, metadata);
        }

        break;
      case MessageTypes.CF_CALL_RECEIVED:
        if (sid == 0) {
          let mpayload = undefined;
          try {
            mpayload = (payload) ? this._mBufferToString(payload) : "";
          } catch (error) {
            mpayload = "";
          }
          this.cf._handle_dispatcher(subject, rsub, sid, mpayload);
        }

        break;
      case MessageTypes.CF_RESPONSE_TRACKER:
        //1. ERROR.CODE = rsub
        //2. response.id =  subject
        this.cf._handle_tracker_dispatcher(subject, rsub);
        break;
      case MessageTypes.CF_CALLEE_QUEUE_EXCEEDED:
        this.cf._handle_exceed_dispatcher();
        break;
      case MessageTypes.CONNECT_TO_RPC_SERVER:
        switch (subject) {
        case "success":
          switch (this.rpc._get_rpcStatus(sid)) {
          case rpcStatus.RPC_CONNECTION_INITIATED:
            this.rpc._updateRegistrationStatusAddChange(0, sid, rpcStatus.RPC_CONNECTION_ACCEPTED, "");
            break;
          case rpcStatus.RPC_CONNECTION_ACCEPTED:
          case rpcStatus.RPC_CONNECTION_PENDING:
            this.rpc._updateRegistrationStatusAddChange(1, sid, rpcStatus.RPC_CONNECTION_ACCEPTED, "");
            break;
          }
          break;
        default: //fail:access_denied fail:error
          dberr = new dBError("E082");
          dberr.updatecode(subject.toUpperCase(), "");
          switch (this.rpc._get_rpcStatus(sid)) {
          case rpcStatus.RPC_CONNECTION_INITIATED:
            this.rpc._updateRegistrationStatusAddChange(0, sid, rpcStatus.RPC_CONNECTION_ERROR, dberr);
            break;
          case rpcStatus.RPC_CONNECTION_ACCEPTED:
          case rpcStatus.RPC_CONNECTION_PENDING:
            this.rpc._updateRegistrationStatusAddChange(1, sid, rpcStatus.RPC_CONNECTION_PENDING, dberr);
            break;
          }
          break;
        }
        break;
      case MessageTypes.RPC_CALL_RESPONSE:
        mpayload = "";
        try {
          mpayload = (payload) ? this._mBufferToString(payload) : "";
        } catch (error) {
          mpayload = "";
        }
        rpccaller = this.rpc.get_object(sid);
        rpccaller._handle_callResponse(sid, mpayload, rspend, rsub);
        break;

      case MessageTypes.RPC_CALL_RECEIVED:

        if (sid == 0) {
          mpayload = undefined;
          try {
            mpayload = (payload) ? this._mBufferToString(payload) : "";
          } catch (error) {
            mpayload = "";
          }
          let caller = this.rpc.get_rpcServerObject(sid);
          caller._handle_dispatcher(subject, rsub, sid, mpayload);
        }
        break;

      case MessageTypes.RPC_RESPONSE_TRACKER:
        //1. ERROR.CODE = rsub
        //2. response.id =  subject
        rpccaller = this.rpc.get_object(sid);
        rpccaller._handle_tracker_dispatcher(subject, rsub);
        break;
      case MessageTypes.RPC_CALLEE_QUEUE_EXCEEDED:
        rpccaller = this.rpc.get_object(sid);
        rpccaller._handle_exceed_dispatcher();
        break;



      }
    }

    _convertToObject = (sourceip, sourceid, channelname = undefined) => {
      let sessionid = "";
      let libtype = "";
      let sourceipv4 = "";
      let sourceipv6 = "";
      let sourcesysid = "";

      if (sourceid) {
        var strData = sourceid.split("#");
        if (strData.length > 1) sessionid = strData[0];
        if (strData.length > 2) libtype = strData[1];
        if (strData.length > 3) sourceipv4 = strData[2];
        if (strData.length > 4) sourceipv6 = strData[3];
        if (strData.length >= 5) sourcesysid = strData[4];
      }

      let inObject = (channelname) ? {
        "sessionid": sessionid, "libtype": libtype,
        "sourceipv4": sourceipv4, "sourceipv6": sourceipv6, "sysinfo": sourceip,
        "channelname": channelname, "sourcesysid": sourcesysid
      } : {
        "sessionid": sessionid, "libtype": libtype,
        "sourceipv4": sourceipv4, "sourceipv6": sourceipv6, "sysinfo": sourceip, "sourcesysid": sourcesysid
      };

      return { "i": inObject, "s": sessionid ,  "sysyid": sourcesysid};

    }


    _IOConnect = () => {
      //this.connectionstate._handledispatcher(states.CONNECTED, {});
      //this._ClientSocket.sendBuffer = [];
    }

    _IOConnectFailed = (info) => {

      this.connectionstate._handledispatcher(states.ERROR, info);
      if (this._ClientSocket) this._ClientSocket.removeAllListeners();

      if (this.autoReconnect) this._reconnect();
    }

    _IOError = (err) => {
      this.connectionstate._handledispatcher(states.ERROR, err);
      if (this._ClientSocket) this._ClientSocket.removeAllListeners();
      if (this.autoReconnect) this._reconnect();

    }


    _isSocketConnected() {
      return (this._ClientSocket) ? this._ClientSocket.connected : false;
    }

    send = (msgDbp) => {
      let flag = false;
      if (this._ClientSocket.connected) {
        this._ClientSocket.emit(
          msgDbp.eventname,
          msgDbp.dbmsgtype,
          msgDbp.subject,
          msgDbp.rsub,
          msgDbp.sid,
          msgDbp.payload,
          msgDbp.fenceid,
          msgDbp.rspend,
          msgDbp.rtrack,
          msgDbp.rtrackstat,
          msgDbp.t1,
          msgDbp.latency,
          msgDbp.globmatch,
          msgDbp.sourceid,
          msgDbp.sourceip,
          msgDbp.replylatency,
          msgDbp.oqueumonitorid
        );
        flag = true;
      }
      return flag;
    }
}
