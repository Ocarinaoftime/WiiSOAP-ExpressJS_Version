var express = require('express');
//import xmlQuery, { XmlNode } from "xml-query";
var bodyParser = require('body-parser');
var fs = require('fs');
var https = require('https');
var privateKey  = fs.readFileSync('key.key', 'utf8');
var certificate = fs.readFileSync('cert.pem', 'utf8');
var sslConfig = require('ssl-config')('intermediate');
var credentials = {key: privateKey, cert: certificate};
var action: string;
interface Envelope {
  '$': object;
  'soapenv:Body': Body;
}


interface Body {
  [Response: `${string}Response`]: Response
}


interface Response {
  '$': { 'xmlns': string }; 
  Version: string;
  DeviceId: string;
  MessageId: string;
  TimeStamp: string;
  ErrorCode: number;
  ServiceStandbyMode: boolean;
  [key: string]: any;
}

const app = express();
const port = 3000;
var httpsServer = https.createServer({
  key: credentials.key, 
  cert: credentials.cert,
  ciphers: "DEFAULT@SECLEVEL=0",
  secureOptions: sslConfig.minimumTLSVersion
}, app);
var ast: any;
const SharedChallenge = "NintyWhyPls";
//import { DOMParser, XMLSerializer } from 'xmldom';

import { parseStringPromise, Builder } from 'xml2js';

const namespaceParse = /^urn:(.{3})\.wsapi\.broadon\.com\/(.*)$/;

// parseAction interprets contents along the lines of "urn:ecs.wsapi.broadon.com/CheckDeviceStatus",
// where "CheckDeviceStatus" is the action to be performed.
function parseAction(original: string) {
  // Intended to return the original string, the service's name and the name of the action.
  const matches = namespaceParse.exec(original);
  if (!matches || matches.length !== 3) {
    // It seems like the passed action was not matched properly.
    return ['', ''];
  }

  const service = matches[1];
  const action = matches[2];
  return [service, action];
}

// NewEnvelope returns a new Envelope with proper attributes initialized.
function NewEnvelope(service: string, action1: string): Envelope {
  // Get a sexy new timestamp to use.
  const timestampNano = Date.now().toString().slice(0, 13);
  action = action1;

  return {
    '$': {
      'xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
      'xmlns:xsd':'http://www.w3.org/2001/XMLSchema',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    },
    'soapenv:Body': {
      [`${action}Response`]: {
        '$': { xmlns: 'urn:' + service + '.wsapi.broadon.com' },
        TimeStamp: timestampNano,
        ErrorCode: 0,
        Version: '',
        DeviceId: '',
        MessageId: '',
        ServiceStandbyMode: false,
        //key: {},
        //customType: {},
      },
    },
  }
};

// Action returns the action for this service.
function Action(e: Envelope): string {
  return action;
}

// Timestamp returns a shared timestamp for this request.
function Timestamp(e: Envelope): string {
  return e['soapenv:Body'][`${action}Response`].TimeStamp;
}

// DeviceId returns the Device ID for this request.
function DeviceId(e: Envelope): string {
  return e['soapenv:Body'][`${action}Response`].DeviceId as string;
}

// ObtainCommon interprets a given node, and updates the envelope with common key values.
function ObtainCommon(e: Envelope, doc: string | any): [any, null] {
  // These fields are common across all requests.
  var err;
  e['soapenv:Body'][`${action}Response`].Version = getKey(doc[0], 'Version')[0];
  err = getKey(doc[0], 'Version')[1];
  //console.log("err ", err)
  if (err !== null) {
     return [err, null]
  }
  e['soapenv:Body'][`${action}Response`].DeviceId = getKey(doc[0], 'DeviceId')[0];
  err = getKey(doc[0], 'DeviceId')[1];
  //console.log("err ", err)
  if (err !== null) {
    return [err, null];
  }
  e['soapenv:Body'][`${action}Response`].MessageId = getKey(doc[0], 'MessageId')[0];
  err = getKey(doc[0], 'MessageId')[1];
  //console.log("err ", err)
  if (err !== null) {
    return [err, null]
  }

  return [null, null];
}

// AddKVNode adds a given key by name to a specified value, such as <key>value</key>.
function AddKVNode(e: Envelope, key: string, value: string): void {
  e["soapenv:Body"][`${action}Response`][key] = value;
}

// AddCustomType adds a given key by name to a specified structure.
function AddCustomType(e: Envelope, customType: any): void {
  e['soapenv:Body'][`${action}Response`].customType = customType;
}

// becomeXML marshals the Envelope object, returning the intended boolean state on success.
// ..there has to be a better way to do this, TODO.
function becomeXML(e: Envelope, intendedStatus: boolean): [boolean, string] {
  try {
    const builder = new Builder({rootName: 'soapenv:Envelope'});
    const contents = builder.buildObject(e);
    //const result = '<?xml version="1.0" encoding="UTF-8"?>\n' + contents;
    return [intendedStatus, contents];
  } catch (err: any) {
    //console.log("regex: " + /^([:A-Z_a-z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])([\x2D\.0-:A-Z_a-z\xB7\xC0-\xD6\xD8-\xF6\xF8-\u037D\u037F-\u1FFF\u200C\u200D\u203F\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])*$/);
    return [false, "an error occurred marshalling XML: " + err];
  }

}
function ReturnSuccess(e: Envelope): [boolean, string] {
  e['soapenv:Body'][`${action}Response`].ErrorCode = 0;

  return becomeXML(e, true)
}

function ReturnError(e: Envelope, errorCode: number, reason: string, err: any): [boolean, string] {
  e['soapenv:Body'][`${action}Response`].ErrorCode = errorCode;

  e['soapenv:Body'][`${action}Response`].CustomFields = {};

  AddKVNode(e, "UserReason", reason);
  AddKVNode(e, "ServerReason", err);

  return becomeXML(e, false)
}

function getKey(doc: string, key: string): [any, any] {
  var subStr = doc.search(key)
  var node = doc.substring(subStr);
  var splitted = node.split("\n")[0];
  var value = splitted.substring(splitted.search(key)+key.length+1).split("<")[0];
  
  if (subStr == -1) {
    return ["", Error("Cannot find mandatory key named " + key)];
  } else {
    return [value, null]
  }
}



function normalise(service: string, action: string, doc: string): [string | null, Error | null] {
  var result = doc.includes(service + ":" + action);

  if (result === false) {
    return [null, Error("Missing root node")]
  }

  var newStr = doc.substring(doc.search("<" + service + ":" + action))
  
  return [String(newStr), null]
}

// Handlers for the services
function iasHandler(e: Envelope, doc: string | any): [boolean | any, string | any] {
  var err;
  var region, country, language;
  var regionVal = getKey(doc[0], "Region");
  err = regionVal[1];
  region = regionVal[0];
  
  //console.log("region: " + region);
  if (err !== null) {
    return ReturnError(e, 51, "no region", err);
  }
  var countryVal = getKey(doc[0], "Country");
  err = countryVal[1]
  country = countryVal[0];
  //console.log("country: " + country);
  if (err !== null) {
    return ReturnError(e, 52, "no country", err);
  }
  var languageVal = getKey(doc[0], "Language");
  err = languageVal[1];
  language = languageVal[0];
  //console.log("language: " + language);
  if (err !== null) {
    return ReturnError(e, 53, "no language", err);
  }

  switch (Action(e)) {
    case "CheckRegistration":
      var serialNo;
      var serialNoVal = getKey(doc[0], "SerialNumber");
      err = serialNoVal[1];
      serialNo = serialNoVal[0];
      if (err !== null) {
        return ReturnError(e, 5, "No serial number", err);
      }

      console.log("The request is valid! Responding...\n");
      AddKVNode(e, "OriginalSerialNumber", serialNo);
      AddKVNode(e, "DeviceStatus", "R");
      break
    
    case "GetChallenge":
      console.log("The request is valid! Responding...\n");
      // The official Wii Shop Channel requests a Challenge from the server, and promptly disregards it.
		  // (Sometimes, it may not request a challenge at all.) No attempt is made to validate the response.
		  // It then uses another hard-coded value in place of this returned value entirely in any situation.
		  // For this reason, we consider it irrelevant.
      AddKVNode(e, "Challenge", SharedChallenge);
      break
    
    case "GetRegistrationInfo":
      var reason = "how dirty. ;3"
      var accountIdVal = getKey(doc[0], "AccountId");
      err = accountIdVal[1];
      accountId = accountIdVal[0];
      if (err != null) {
        return ReturnError(e, 7, reason, err)
      }
    
      var deviceCodeVal = getKey(doc[0], "DeviceCode");
      err = deviceCodeVal[1];
      deviceCode = deviceCodeVal[0];
      if (err != null) {
        return ReturnError(e, 7, reason, err)
      }
    
      console.log("The request is valid! Responding...\n")
      AddKVNode(e, "AccountId", String(accountId))
      AddKVNode(e, "DeviceToken", "00000000")
      AddKVNode(e, "DeviceTokenExpired", "false")
      AddKVNode(e, "Country", String(country))
      AddKVNode(e, "ExtAccountId", "")
      AddKVNode(e, "DeviceCode", String(deviceCode))
      AddKVNode(e, "DeviceStatus", "R")
      // This _must_ be POINTS.
      AddKVNode(e, "Currency", "POINTS")
      break
      
    case "Register":
        // Copy "GetRegistrationInfo" because a database is not necessary at the moment
        var reason = "how dirty. ;3"
        var accountIdVal = getKey(doc[0], "AccountId")
        err = accountIdVal[1];
        var accountId = accountIdVal[0];
        if (err != null) {
          return ReturnError(e, 7, reason, err)
        }
    
        var deviceCodeVal = getKey(doc[0], "DeviceCode");
        err = deviceCodeVal[1];
        var deviceCode = deviceCodeVal[0];
        if (err != null) {
          return ReturnError(e, 7, reason, err)
        }
    
        console.log("The request is valid! Responding...\n")
        AddKVNode(e, "AccountId", String(accountId))
        AddKVNode(e, "DeviceToken", "00000000")
        AddKVNode(e, "DeviceTokenExpired", "false")
        AddKVNode(e, "Country", String(country))
        AddKVNode(e, "ExtAccountId", "")
        AddKVNode(e, "DeviceCode", String(deviceCode))
        AddKVNode(e, "DeviceStatus", "R")
        // This _must_ be POINTS.
        AddKVNode(e, "Currency", "POINTS")
        break
      
    case "Unregister":
        // Very unusual >:(
        console.log("The request is valid! Responding with nothing...\n");
        break
      
    default:
        return [false, "I can't handle this. Try again later"]
      
      

  } 
  return ReturnSuccess(e);
}

function ecsHandler(e: Envelope, doc: string | any): [boolean | any, string | any] {
  switch (Action(e)) {
    case "CheckDeviceStatus":
      console.log("The request is valid! Responding...");
      AddCustomType(e, {amount: 9999, currency: "POINTS"});
      AddKVNode(e, "ForceSyncTime", "0");
      AddKVNode(e, "ExtTicketTime", Timestamp(e));
      AddKVNode(e, "SyncTime", Timestamp(e));
      break
    
    case "NotifyETicketsSynced":
      // This is a disgusting request apparently, but "20 dollars is 20 dollars".

      console.log("The request is valid! Repsonding...");
      break
    
    case "ListETickets":
      // "that's all you got for me? ;3"

      console.log("The request is valid! Responding...");
      AddKVNode(e, "ForceSyncTime", "0");
      AddKVNode(e, "ExtTicketTime", Timestamp(e));
      AddKVNode(e, "SyncTime", Timestamp(e))
      break

    case "PurchaseTitle":
      // "If you wanna fun time, it's gonna cost ya extra sweetie... ;3"

      console.log("The request is valid! Responding...");
      AddCustomType(e, {
        Amount: 2018,
        Currency: "POINTS",
      });
      AddCustomType(e, {
        TransactionId: "00000000",
        Date: Timestamp(e),
        Type: "PURCHGAME",
      });
      AddKVNode(e, "SyncTime", Timestamp(e));
      AddKVNode(e, "Certs", "00000000");
      AddKVNode(e, "TitleId", "00000000");
      AddKVNode(e, "ETickets", "00000000");
      break

    default: 
      return [false, "I can't handle this. Try again later."]
  }

  return ReturnSuccess(e);
}

// Finally we can get to the HTTP request handling
//app.use(bodyParser.text());

async function commonHandler(req: any, res: any) {
  console.log(ast);
  // Find out what action is sent from the header
  var service = parseAction(String(req.header("SOAPAction")))[0];
  var action = parseAction(String(req.header("SOAPAction")))[1];
  if (service == "" || action == "") {
    console.error("I can't handle this. Try again later.\n");
    res.status(500).send("I can't handle this. Try again later.\n Can't read SOAPAction header");
    return
  }

  switch (service) {
    case "ecs":
    case "ias":
      break
    default:
      console.error("I can't handle this. Try again later.\n")
      res.status(500).send("I can't handle this. Try again later.\n No service");
      return
  }

  console.log("[!] Incoming " + service.toUpperCase() + " request - handling for " + action)
  var body = req.body;
  var doc = normalise(service, action, body);

  //console.log("doc", doc)

  if (doc[1] !== null) {
    console.error("Error interpreting request body: " + doc[1].message + "\n\nnormalise() error");
    res.status(500).send("Error interpreting request body: " + doc[1].message + "\n\nnormalise() error\n\n" + action);
    return
  }
  
  console.log(("Received: " + String(body)));

  var envelope = NewEnvelope(service, action);

  var err = ObtainCommon(envelope, doc)[0];

  if (err !== null) {
    console.error("Error handling request body: " + String(err) + "\n\nObtainCommon() error");
    res.status(500).send("Error handling request body: " + String(err) + "\n\nObtainCommon() error");
    return
  }

  var successful;
  var result;
  if (service == "ias") {
    successful = iasHandler(envelope, doc)[0];
    result = iasHandler(envelope, doc)[1];
  } else if (service == "ecs") {
    successful = ecsHandler(envelope, doc)[0];
    result = ecsHandler(envelope, doc)[1];
  }

  if (successful) {
		// Write returned with proper Content-Type
		res.header("Content-Type").set("text/xml; charset=utf-8");
    res.status(200).send(result);
	} else {
		console.error(result)
    res.status(500).send("Service handler unsuccessful");
	}
  console.log("[!] End of " + String(service).toUpperCase() + " Request.\n")
}

app.get("/", (req: any, res: any) => {
  res.status(404).send("Incorrect URL");
});
app.get("/ecs/services/ECommerceSOAP", (req: any, res: any) => {
  res.status(200).send("<h1>ECommerceSOAP</h1><p>Hi there, this is an AXIS service!</p><i>Perhaps there will be a form for invoking the service here...</i>");
})
app.get("/ias/services/IdentityAuthenticationSOAP", (req: any, res: any) => {
  res.status(200).send("<h1>IdentityAuthenticationSOAP</h1><p>Hi there, this is an AXIS service!</p><i>Perhaps there will be a form for invoking the service here...</i>");
})
app.post("/ecs/services/ECommerceSOAP", bodyParser.text({type: "*/*"}), commonHandler)
app.post("/ias/services/IdentityAuthenticationSOAP", bodyParser.text({type: "*/*"}), commonHandler)
app.post("/", bodyParser.text({type: "*/*"}), (req: any, res: any) => {
  //res.send(req.body);
  //const un = XmlReader.parseSync(req.body);
  //const xq = xmlQuery(un);
  //console.log(xq.has("ias:CheckRegistration"));
  console.log("Request body: ", req.body);
  res.send("OK");
})

app.listen(port, () => {
  console.log(`HTTP Server listening on port ${port}`);
});
httpsServer.listen(443, () => {
  console.log("HTTPS Server listening on port 443");
});
