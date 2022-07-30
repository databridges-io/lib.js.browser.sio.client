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
import { dBError } from "../exception/errorMessages.js";
import * as utils from "../Utils/util.js";
import { MessageTypes } from "../msgTypes/dBMessageTypes.js";

export class Crpcclient { 

  constructor(dBCoreObject) {
    this._dispatch = new dispatcher();
    this._dbcore = dBCoreObject;
    this.enable = false;
    this.functions = undefined;
    this._functionNames = ["cf.response.tracker", "cf.callee.queue.exceeded"];
  } 

  _verify_function() {
    let mflag = false;
    if (this.enable) {
      if (!this.functions) throw (new dBError("E009"));
      if (typeof this.functions != "function") throw (new dBError("E010"));
      mflag = true;
    } else {
      mflag = true;
    }
    return mflag;
  } 

  regfn(functionName, callback) {
    if (!(functionName)) throw (new dBError("E110")); 
    if (!(callback)) throw (new dBError("E111")); 
    if (!(typeof functionName === "string")) throw (new dBError("E110"));
    if (!(typeof callback === "function")) throw (new dBError("E111"));

    if(this._functionNames.includes(functionName)) throw (new dBError("E110"));
    this._dispatch.bind(functionName, callback);
  }


  unregfn(functionName, callback) {
    if(this._functionNames.includes(functionName)) return;
    this._dispatch.unbind(functionName, callback);
  }



  bind(eventName, callback) {
    if (!(eventName)) throw (new dBError("E066")); 
    if (!(callback)) throw (new dBError("E067")); 
    if (!(typeof eventName === "string")) throw (new dBError("E066"));
    if (!(typeof callback === "function")) throw (new dBError("E067"));

    if(!this._functionNames.includes(eventName)) throw (new dBError("E066"));
    
    this._dispatch.bind(eventName, callback);
  }


  unbind(eventName, callback) {
    if(!this._functionNames.includes(eventName)) return;
    this._dispatch.unbind(eventName, callback);

  }


  _handle_dispatcher(functionName, returnSubect, sid, payload) {
    let response = new CrpcResponse(functionName, returnSubect, sid, this._dbcore);
    this._dispatch.emit_clientfunction(functionName, payload, response);
  }

  _handle_tracker_dispatcher(responseid, errorcode) {

    this._dispatch.emit_clientfunction("cf.response.tracker", responseid, errorcode);
  }

  _handle_exceed_dispatcher() {
    let err = new dBError("E070");
    err.updatecode("CALLEE_QUEUE_EXCEEDED");
    this._dispatch.emit_clientfunction("cf.callee.queue.exceeded", err, null);
  }

  resetqueue() {
    let m_status  = utils.updatedBNewtworkCF(this._dbcore, MessageTypes.CF_CALLEE_QUEUE_EXCEEDED, null, null, null, null, null, null, null);
    if (!m_status) throw (new dBError("E068"));
  }

}
