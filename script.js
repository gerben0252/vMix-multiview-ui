var vars = {};
var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
    vars[key] = value;
});

var vMixSettings = {
    IP: "127.0.0.1",
    port: "8088",
    previousProgram: -1,
    preivousPreview: -1,

    multiViewInput: 2,
    overlayInput: 10,
    refreshInterval: 150,
    showAudioMeters: true,
    layerNameFontSize: 14
}

function toTitleCase(str) {
    return str.replace(/(?:^|\s)\w/g, function(match) {
        return match.toUpperCase();
    });
}

if(vars["Input"]){
    vMixSettings.multiViewInput = parseFloat(vars["Input"]) - 1;
}   

if(vars["Interval"]){
    vMixSettings.refreshInterval = parseFloat(vars["Interval"]);
}

setInterval(() => {
    fetch('http://' + vMixSettings.IP + ':' + vMixSettings.port + '/api')
    .then(response => response.text())
    .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
    .then(data => vMixRefresh(data));

}, vMixSettings.refreshInterval);

var overlayArray = [];
var multiViewOverlays = [];
var lastResponse;
var vMixInputs = []

function log10(x) {
    if(Math.log(x)*20 == -Infinity){
        return 0;
    }
    else{
        return Math.log(x)*21.5;
    }
}

function vMixRefresh(data){
    lastResponse = data;
    var temporaryMultiViewOverlays = []
    vMixSettings.previewNumber = parseFloat(data.getElementsByTagName("preview")[0].innerHTML)
    vMixSettings.programNumber = parseFloat(data.getElementsByTagName("active")[0].innerHTML)
    vMixSettings.previewKey = data.querySelector(`[number="${vMixSettings.previewNumber}"]`).getAttribute("key")
    vMixSettings.programKey = data.querySelector(`[number="${vMixSettings.programNumber}"]`).getAttribute("key")

    Array.prototype.slice.call(data.getElementsByTagName("input"), 0 ).forEach(function(input, i){
        vMixInputs[i] = {}
        vMixInputs[i].title = input.getAttribute("title");
        vMixInputs[i].key = input.getAttribute("key");
        if(input.getAttribute("muted")){
            vMixInputs[i].audio = true
            vMixInputs[i].muted = input.getAttribute("muted") == "True"
            vMixInputs[i].audioL = log10(input.getAttribute("meterF1") * 100)
            vMixInputs[i].audioR = log10(input.getAttribute("meterF2") * 100)
        }
        else{
            vMixInputs[i].audio = false
        }
        if(input.getAttribute("duration")){
            vMixInputs[i].video = true
            vMixInputs[i].duration = input.getAttribute("duration")
            vMixInputs[i].position = input.getAttribute("position")
        }
        else{
            vMixInputs[i].video = false
        }
    })
    
    overlayArray = Array.prototype.slice.call(data.getElementsByTagName("input")[vMixSettings.multiViewInput].getElementsByTagName("overlay"), 0 );

    if(overlayArray.length == 0){
        $(".warning").html("No multiview layers on input " + (parseFloat(vMixSettings.multiViewInput) + 1));
        $(".warning").css("display", "flex");
    }
    else{
        $(".warning").css("display", "none");
    }

    
    
    for(var i = 0; i < overlayArray.length && i < 9; i++){
        if(parseFloat(overlayArray[i].getAttribute("index")) != 9){

            if(overlayArray[i].getElementsByTagName("position")[0] != undefined){
                var zoomY =     (parseFloat(overlayArray[i].getElementsByTagName("position")[0].getAttribute("zoomY"))   *   100);
                var zoomX =     (parseFloat(overlayArray[i].getElementsByTagName("position")[0].getAttribute("zoomX"))   *   100);
                var panY =      (parseFloat(overlayArray[i].getElementsByTagName("position")[0].getAttribute("panY"))    *   100);
                var panX =      (parseFloat(overlayArray[i].getElementsByTagName("position")[0].getAttribute("panX"))    *   100);
                var inputKey =  overlayArray[i].getAttribute("key")
                var inputName =  lastResponse.querySelector(`input[key="${inputKey}"]`).getAttribute("title")
            }
            else{
                var zoomY =     (100);
                var zoomX =     (100);
                var panY =      (0);
                var panX =      (0);
                var inputKey =  overlayArray[i].getAttribute("key")
                var inputName =  lastResponse.querySelector(`input[key="${inputKey}"]`).getAttribute("title")

            }

            temporaryMultiViewOverlays[i] = {
                zoomX,
                zoomY,
                panX,
                panY,
                inputKey,
                inputName,
            }
                        
        }
    }
    
    var forceRefresh = false
    if(JSON.stringify(temporaryMultiViewOverlays) != JSON.stringify(multiViewOverlays) || forceRefresh){
        multiViewOverlays = JSON.parse(JSON.stringify(temporaryMultiViewOverlays))
        refresh();
        updateTally(true);
        
    }
    updateTally();
    updateVU();
}

function updateVU(){
    overlayArray.forEach((overlay, i) => {
        if(vMixInputs[vMixInputs.findIndex(vMixInputs => vMixInputs.key === overlay.getAttribute("key"))].audio){
            $($(".outerContainer").children()[i]).find(".actualMeterL").css("clip-path", "inset(" + (Math.floor((100 - vMixInputs[vMixInputs.findIndex(vMixInputs => vMixInputs.key === overlay.getAttribute("key"))].audioL)/3.125)*3.125) + "% 0% 0% 0%)");
            $($(".outerContainer").children()[i]).find(".actualMeterR").css("clip-path", "inset(" + (Math.floor((100 - vMixInputs[vMixInputs.findIndex(vMixInputs => vMixInputs.key === overlay.getAttribute("key"))].audioR)/3.125)*3.125) + "% 0% 0% 0%)");
            if(vMixInputs[vMixInputs.findIndex(vMixInputs => vMixInputs.key === overlay.getAttribute("key"))].muted){
                $($(".outerContainer").children()[i]).find(".actualMeterR").css("filter", "grayscale(100%)");
                $($(".outerContainer").children()[i]).find(".actualMeterL").css("filter", "grayscale(100%)");
            }
            else{
                $($(".outerContainer").children()[i]).find(".actualMeterR").css("filter", "grayscale(0%)");
                $($(".outerContainer").children()[i]).find(".actualMeterL").css("filter", "grayscale(0%)");

            }
        }
    });
}

function generateVU(bool, overlay) {
    if (vMixSettings.showAudioMeters && bool) { // Controleer of de audiometers aan moeten staan
        return(`
        <div class="leftAlignContainer">
            <div class="audioMeterContainer">
                <div class="audioMeter">
                    <div class="meterOutline"></div>
                    <div class="actualMeter actualMeterL"></div>
                </div>
                <div class="audioMeter">
                    <div class="meterOutline"></div>
                    <div class="actualMeter actualMeterR"></div>
                </div>
                <div class="VUlabels">
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">0</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-5</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-10</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-15</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-20</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-25</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-30</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-40</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-50</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-60</div>
                </div>
            </div>
            <div class="LRlabels">
                <div class="LRlabel" style="transform: scale(${overlay.zoomY / 100})">
                    L
                </div>
                <div class="LRlabel" style="transform: scale(${overlay.zoomY / 100})">
                    R
                </div>
            </div>
        </div>
        `);
    } else {
        return "";
    }
}
function generateVU(bool, overlay) {
    if (vMixSettings.showAudioMeters && bool) { // Controleer of de audiometers aan moeten staan
        return(`
        <div class="leftAlignContainer">
            <div class="audioMeterContainer">
                <div class="audioMeter">
                    <div class="meterOutline"></div>
                    <div class="actualMeter actualMeterL"></div>
                </div>
                <div class="audioMeter">
                    <div class="meterOutline"></div>
                    <div class="actualMeter actualMeterR"></div>
                </div>
                <div class="VUlabels">
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">0</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-5</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-10</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-15</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-20</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-25</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-30</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-40</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-50</div>
                    <div class="VUlabel" style="transform: scale(${overlay.zoomY / 100})">-60</div>
                </div>
            </div>
            <div class="LRlabels">
                <div class="LRlabel" style="transform: scale(${overlay.zoomY / 100})">
                    L
                </div>
                <div class="LRlabel" style="transform: scale(${overlay.zoomY / 100})">
                    R
                </div>
            </div>
        </div>
        `);
    } else {
        return "";
    }
}


function refresh() {
    $(".outerContainer").html("")
    
    // Exclude overlay matching overlayInput
    multiViewOverlays.forEach(overlay => {
        if (parseFloat(overlay.inputKey) !== vMixSettings.overlayInput) { 
            $(".outerContainer").append(`
            <div class="multiViewBox" style="
                height: ${overlay.zoomY}%;
                width:  ${overlay.zoomX}%;
                left:   ${((overlay.panX) / 2) + 50}%;
                top:    ${((overlay.panY * -1) / 2) + 50}%;
            ">
            <div class="inputTitle" style="font-size: ${vMixSettings.layerNameFontSize}px;">
                ${lastResponse.querySelector(`input[key="${overlay.inputKey}"]`).getAttribute("title")}
            </div>
            ${generateVU(vMixInputs[vMixInputs.findIndex(vMixInputs => vMixInputs.key === overlay.inputKey)].audio, overlay)}
            </div>
            `)
        }
    });
}



function updateTally(force){
    if(vMixSettings.previousPreviewKey != vMixSettings.previewKey || force){
        if(multiViewOverlays.findIndex(overlay => overlay.inputKey === vMixSettings.previousPreviewKey) != -1){
            $($(".outerContainer").children()[multiViewOverlays.findIndex(overlay => overlay.inputKey === vMixSettings.previousPreviewKey)]).removeClass("preview");
        }
        $($(".outerContainer").children()[multiViewOverlays.findIndex(overlay => overlay.inputKey === vMixSettings.previewKey)]).addClass("preview");
        vMixSettings.previousPreviewKey = vMixSettings.previewKey
    }
    if(vMixSettings.previousProgramKey != vMixSettings.programKey || force){
        if(multiViewOverlays.findIndex(overlay => overlay.inputKey === vMixSettings.previousProgramKey) != -1){
            $($(".outerContainer").children()[multiViewOverlays.findIndex(overlay => overlay.inputKey === vMixSettings.previousProgramKey)]).removeClass("program");
        }
        $($(".outerContainer").children()[multiViewOverlays.findIndex(overlay => overlay.inputKey === vMixSettings.programKey)]).addClass("program");
        vMixSettings.previousProgramKey = vMixSettings.programKey
    }
}
