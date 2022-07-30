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


import { MessageTypes } from "../msgTypes/dBMessageTypes.js";
import * as utils from "../Utils/util.js";
import { dBError } from "../exception/errorMessages.js";

export class CrpcResponse { 


  constructor(functionName, returnSubect, sid, dbcoreobject) {
    this._functionName = functionName;
    this._returnSubsect = returnSubect;
    this._sid = sid;
    this._dbcore = dbcoreobject;
    this._isend = false;
    this._id = returnSubect;
    this.tracker = false;
  }

  get id() {
    return this._id;
  }

  next(data) {
    if (!this._isend) {
      let cstatus = utils.updatedBNewtworkCF(this._dbcore, MessageTypes.CF_CALL_RESPONSE, null, this._returnSubsect, null, this._sid, data, this._isend, this.tracker);
      if (!cstatus) throw (new dBError("E068"));
    } else {
      throw (new dBError("E105"));
    }
  }
  end(data) {
    if (!this._isend) {
      this._isend = true;
      let cstatus = utils.updatedBNewtworkCF(this._dbcore, MessageTypes.CF_CALL_RESPONSE, null, this._returnSubsect, null, this._sid, data, this._isend, this.tracker);
      if (!cstatus) throw (new dBError("E068"));

    } else {
      throw (new dBError("E105"));
    }
  }

  exception(expCode, expShortMessage) {
    let epayload = JSON.stringify({ "c": expCode, "m": expShortMessage });

    if (!this._isend) {
      this._isend = true;
      let cstatus = utils.updatedBNewtworkCF(this._dbcore, MessageTypes.CF_CALL_RESPONSE, null, this._returnSubsect, "EXP", this._sid, epayload, this._isend, this.tracker);
      if (!cstatus) throw (new dBError("E068"));

    } else {
      throw (new dBError("E105"));
    }
  }
}