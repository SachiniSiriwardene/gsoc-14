/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 Components.utils.import("resource://testing-common/httpd.js");
 Components.utils.import("resource://gre/modules/NetUtil.jsm")
 Components.utils.import("resource://gre/modules/CSPUtils.jsm");
 Components.utils.import("resource://calendar/modules/calUtils.jsm");
 Components.utils.import("resource://gre/modules/FileUtils.jsm");

 var fileContent=""; //using this temporary
 var currentScheduleTag;
 var currentEtag;
 function run_test() {
  //start server
  server = new HttpServer(); 
  server.registerPathHandler("/calendar/event.ics", createResourceHandler);
  server.registerPathHandler("/calendar/",initPropfindHandler);
  server.start(50001);
  add_test(test_CreateResource());
  do_test_pending();
  // run_next_test();
  
  // do_test_pending();
  //print(data);
}

//method to create the item with calendar.addItem which is pointed to localhost
function test_CreateResource(){

 let icalString ="BEGIN:VEVENT\n" + 
 "DTSTART:20020402T114500Z\n" +
 "DTEND:20020402T124500Z\n" +
 "END:VEVENT\n";

 var createListener = {
  onOperationComplete: function(aCalendar,
    aStatus,
    aOperationType,
    aId,
    aDetail) {
    print("onOperationComplete:"+aCalendar.name+" "+aStatus+" "+aOperationType+" "+aId+" "+aDetail);

  }
};

var item = createEventFromIcalString(icalString);
item.id = "event";
let calmgr = cal.getCalendarManager();
print(item.id);

let calendar = calmgr.createCalendar("caldav", Services.io.newURI("http://localhost:50001/calendar", null, null));
calendar.name="testCalendar";
calendar.addItem(item, createListener);
print("event added");
//do_test_finished(); //uncomment this part to pass the test. commented to see log outputs.

}

//handler for incoming requests to http://localhost:50001/calendar/event.ics
function createResourceHandler(request,response){ 
  print("createResource Handler");
  //get the request and set the response data
  let is = request.bodyInputStream;
  let body = NetUtil.readInputStreamToString(is, is.available(),  { charset: "UTF-8" });
  fileContent = body;
  let method = request.method;
  let matchheader = request.getHeader("If-None-Match");
  print(method+"||"+matchheader);
  print("request body : "+body);
  //write the logic for creating resources
  if(method=="PUT" && matchheader=="*" && body){
    let file = FileUtils.getFile("TmpD", ["event.ics.tmp"]);
    file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, parseInt("0600", 8));
    //this creates the file at /tmp/
    print("file_created at : "+file.path);
    //deleting after the test should also implement. no method found
    writeToFile(file,body);
    response.setStatusLine(request.httpVersion, 201, "resource created");
    response.write("created");
    //after this, there will be a sequence of requests. create those handlers :|
  }
  else{
    response.setStatusLine(request.httpVersion, 400, "Bad Request");
  }

}

function initPropfindHandler(request,response){

  // let file = FileUtils.getFile("TmpD", "event.ics.tmp");
  let is = request.bodyInputStream;
  let body = NetUtil.readInputStreamToString(is, is.available(),  { charset: "UTF-8" });
  print("path:"+request.path+"method:"+request.method+"\n"+body);
  if(request.method=="REPORT"){
    let file = FileUtils.getFile("TmpD", "event.ics.tmp");
    if(file.exists()){
      //get file content
      let initPropResponse = '<D:response>'+
                         '<D:href>'+request.path+'event.ics</D:href>'+
                         '<D:propstat>'+
                         '<D:status>HTTP/1.1 200 OK</D:status>'+
                         '<D:prop>'+
                         '<D:getetag>'+etagGenerator("new")+'</D:getetag>'+
                         '<caldav:schedule-tag>'+scheduleTagGenerator("new")+'</caldav:schedule-tag>'+
                         '<caldav:calendar-data>'+fileContent+
                         '</caldav:calendar-data>'+
                         '</D:prop>'+
                         '</D:propstat>'+
                        ' </D:response>';
    }
    else
    {
      response.setStatusLine(request.httpVersion, 404, "Not Found");
    }
}

function scheduleTagGenerator(mode){
  var newScheduleTag;
  switch(mode){
    case "new" : 
        newScheduleTag = 488177;
        currentScheduleTag = newScheduleTag;
        print("mode:new"+currentScheduleTag);
        break;
    case "orgChange" :
        newScheduleTag = currentScheduleTag+1;
        print("mode:orgChange"+currentScheduleTag);
        break;
    case "attChange" :
        newScheduleTag = currentScheduleTag;
        print("mode:attChange"+currentScheduleTag);
        break;
  }
}
function etagGenerator(mode){
  if(mode=="new"){
    currentEtag = 127876;
    return currentEtag;
  }
  if(mode=="change"){
    return currentEtag+1;
  }
  else{
    return currentEtag;
  }
}

function writeToFile(file,data){
  let ostream = FileUtils.openSafeFileOutputStream(file);
  let converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
  createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  let istream = converter.convertToInputStream(data);
  NetUtil.asyncCopy(istream, ostream, function(status) {
    if (!Components.isSuccessCode(status)) {
      return;
    }
  // Data has been written to the file.
});
}

//this is not working
function readFile(file, callback)
{
  print("came"+file.path+file.exists());
let channel = NetUtil.newChannel(file);
 
 NetUtil.asyncFetch(channel, function(ainputStream, astatus) {
   ok(Components.isSuccessCode(astatus),"file was read successfully");
   print("sss");
   let content = NetUtil.readInputStreamToString(ainputStream,
     ainputStream.available());
   callback(content);
 });
}