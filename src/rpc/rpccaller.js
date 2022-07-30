/* eslint-disable no-async-promise-executor */
/* eslint-disable no-unused-vars */
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

import { dispatcher } from "../dispatcher/dispatcher.js";
import { CrpcResponse } from "./rpcResponse.js";
import * as utils from "../Utils/util.js";
import { MessageTypes } from "../msgTypes/dBMessageTypes.js";
import { CrpcSResponse } from "./rpcSResponse.js";
import { dBError } from "../exception/errorMessages.js";

export class CrpCaller { 
  constructor(serverName, dBCoreObject, rpccoreobject, callertype = "rpc") {
    this._dispatch = new dispatcher();
    this._dbcore = dBCoreObject;
    this._rpccore = rpccoreobject;

    this.enable = false;
    this.functions = undefined;
    this._sid_functionname = new Map();
    this._serverName = serverName;
    this._isOnline = false;
    this._callerTYPE = callertype;
  }


  getServerName() {
    return this._serverName;
  }

  isOnline() {
    return this._isOnline;
  }

  _set_isOnline(value) {
    this._isOnline = value;
  }


  bind(eventName, callback) {
    if (!(eventName)) throw (new dBError("E076"));
    if (!(callback)) throw (new dBError("E077"));
    if (!(typeof eventName === "string")) throw (new dBError("E076"));
    if (!(typeof callback === "function")) throw (new dBError("E077"));
    this._dispatch.bind(eventName, callback);
  }

  unbind(eventName, callback) {
    this._dispatch.unbind(eventName, callback);
  }


  _handle_dispatcher(functionName, returnSubect, sid, payload) {
    let response = new CrpcSResponse(functionName, returnSubect, sid, this._dbcore);
    this._dispatch.emit_clientfunction(functionName, payload, response);
  }


  _handle_callResponse(sid, payload, isend, rsub) {
    if (this._sid_functionname.has(sid)) {
      let mataData = { "functionName": this._sid_functionname.get(sid) };
      this._dispatch.emit_clientfunction(sid, payload, isend, rsub);
    } else {
    // This condition should not occur.. If this condition is found then there is a deadlock situation where dbr is sending the data before time is received by the dbr.
    }
  }

  _handle_tracker_dispatcher(responseid, errorcode) {
    this._dispatch.emit_clientfunction("rpc.response.tracker", responseid, errorcode);
  }

  _handle_exceed_dispatcher() {
    let err = new dBError("E054");
    err.updatecode("CALLEE_QUEUE_EXCEEDED");
    this._dispatch.emit_clientfunction("rpc.callee.queue.exceeded", err, null);
  }



  async _call_internal(sessionid, functionName, inparameter, sid, progress_callback) {
    return new Promise(async (resolve, reject) => {
      let cstatus = undefined;
      if (this._callerTYPE == "rpc") {
        cstatus = utils.updatedBNewtworkCF(this._dbcore, MessageTypes.CALL_RPC_FUNCTION, sessionid, functionName, null, sid, inparameter);
      } else {
        cstatus = utils.updatedBNewtworkCF(this._dbcore, MessageTypes.CALL_CHANNEL_RPC_FUNCTION, sessionid, functionName, null, sid, inparameter);
      }
      if (!cstatus) {
        if (this._callerTYPE == "rpc") {
          reject(new dBError("E079"));
        } else {
          reject(new dBError("E033"));
        }
      }

      this.bind(sid, (response, rspend, rsub) => {
        let dberror = undefined;
        let eobject = undefined;
        if (!rspend) {
          if (progress_callback) progress_callback(response);
        } else {
          if (rsub != null) {
            switch (rsub.toUpperCase()) {
            case "EXP": //exception from callee 
              eobject = JSON.parse(response);
              if (this._callerTYPE == "rpc") {
                dberror = new dBError("E055");
                dberror.updatecode(eobject.c, eobject.m);
                reject(dberror);
              } else { //Channel call
                dberror = new dBError("E041");
                dberror.updatecode(eobject.c, eobject.m);
                reject(dberror);
              }
              break;
            default: // DBNET ERROR 
              if (this._callerTYPE == "rpc") {
                dberror = new dBError("E054");
                dberror.updatecode(rsub.toUpperCase(), "");
                reject(dberror);
              } else { //Channel call
                dberror = new dBError("E040");
                dberror.updatecode(rsub.toUpperCase(), "");
                reject(dberror);
              }
              break;
            }

          } else {
            resolve(response);
          }
          this.unbind(sid);
          this._sid_functionname.delete(sid);
        }
      });
    });
  }

  _GetUniqueSid(sid) {
    let nsid = sid + utils.GenerateUniqueId();
    if (this._sid_functionname.has(nsid)) {
      nsid = ("" + Math.random()).substring(2, 8);
    }
    return nsid;
  }
  
  call(functionName, inparameter, ttlms, progress_callback) {
    let sid = "";
    var sid_created = true;
    var loop_index = 0;
    var loop_counter = 3;
    var mflag = false;
    sid = utils.GenerateUniqueId();


    do {

      if (this._sid_functionname.has(sid)) {
        sid = this._GetUniqueSid(sid);
        loop_index++;
      } else {
        this._sid_functionname.set(sid, functionName);
        mflag = true;
      }
    } while ((loop_index < loop_counter) && (!mflag));

    if (!mflag) {
      sid = this._GetUniqueSid(sid);
      if (!this._sid_functionname.has(sid)) {
        this._sid_functionname.set(sid, functionName);
      } else {
        sid_created = false;
      }
    }

    if (!sid_created) {
      if (this._callerTYPE == "rpc") {
        throw (new dBError("E108"));
      } else {
        throw (new dBError("E109")); 
      }
    }

    this._rpccore.store_object(sid, this);

    let timer = undefined;

    return Promise.race([
      this._call_internal(this._serverName, functionName, inparameter, sid, progress_callback),
      new Promise((_r, rej) => {
        timer = setTimeout(() => {
          this.unbind(sid);
          this._sid_functionname.delete(sid);
          //rej({'source': 'dbridges.library' ,'code': 'RPC_TIMEOUT' ,  'message':''});
          if (this._callerTYPE == "rpc") {
            rej(new dBError("E080"));
          }else{
            rej(new dBError("E042"));
          }
          utils.updatedBNewtworkCF(this._dbcore, MessageTypes.RPC_CALL_TIMEOUT, null, sid, null, null, null, null, null);
          clearTimeout(timer);
        }, ttlms);
      })
    ]).then((result) => {
      if (timer) {
        clearTimeout(timer);
      }
      this._rpccore.delete_object(sid);
      return result;
    }).catch((err) => {
      if (timer) {
        clearTimeout(timer);
      }
      throw err;
    });
  }
 
 
  emit(eventName, eventData, metadata) {
    //this._dispatch.emit(eventName, EventInfo, channelName);

    this._dispatch.emit_channel(eventName, eventData, metadata);

  }


}