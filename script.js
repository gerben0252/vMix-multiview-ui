var vars = {};
var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
    vars[key] = value;
});

var vMixSettings = {
    IP: "127.0.0.1",
    port: "8088",
    multiViewInput: 2,
    previousProgram: -1,
    previousPreview: -1,
    refreshInterval: 150,
    overlayInput: 10,
    showAudioMeters: true,
    layerNameFontSize: 16
};

function search(key, keyValue, Array) {
    for (var i = 0; i < Array.length; i++) {
        if (Array[i][key] === keyValue) {
            return Array[i];
        }
    }
}

function toTitleCase(str) {
    return str.replace(/(?:^|\s)\w/g, function(match) {
        return match.toUpperCase();
    });
}

var saveSettings = [
    "zoomY",
    "zoomX",
    "panX",
    "panY",
    "color",
    "enabled",
    "fontSize"
];

var extras = [
    {
        name: "clock",
        zoomY: 50,
        zoomX: 50,
        panX: 0,
        panY: 0,
        color: "#ffffff",
        enabled: false,
        fontSize: 70,
        template: function(obj) {
            return `
            <div class="multiViewBox" style="
                height: ${obj.zoomY}%;
                width:  ${obj.zoomX}%;
                left:   ${((obj.panX) / 2) + 50}%;
                top:    ${((obj.panY * -1) / 2) + 50}%;
            ">
                <div id="clock" style="color: ${obj.color}; font-size: ${obj.fontSize}px"></div>
                <div class="inputTitle">${toTitleCase(obj.name)}</div>
            </div>`;
        }
    },
    {
        name: "countdown",
        zoomY: 50,
        zoomX: 50,
        panX: 0,
        panY: 0,
        color: "#ffffff",
        enabled: false,
        fontSize: 70,
        template: function(obj) {
            return `
            <div class="multiViewBox" style="
                height: ${obj.zoomY}%;
                width:  ${obj.zoomX}%;
                left:   ${((obj.panX) / 2) + 50}%;
                top:    ${((obj.panY * -1) / 2) + 50}%;
            ">
                <div id="countdown" style="color: ${obj.color}; font-size: ${obj.fontSize}px"></div>
                <div class="inputTitle">${toTitleCase(obj.name)}</div>
            </div>`;
        }
    },
    {
        name: "status",
        zoomY: 50,
        zoomX: 50,
        panX: 0,
        panY: 0,
        enabled: false,
        fontSize: 36,
        template: function(obj) {
            var templateString = `
            <div class="multiViewBox" style="
                height: ${obj.zoomY}%;
                width:  ${obj.zoomX}%;
                left:   ${((obj.panX) / 2) + 50}%;
                top:    ${((obj.panY * -1) / 2) + 50}%;
            ">
                <div class="vMixStatuses" style="font-size: ${obj.fontSize}px">
                    <div class="column">`;
            vMixStatuses.forEach((status, i) => {
                if (i === 3) {
                    templateString += `</div><div class="column">`;
                }
                if (vMixSettings[status]) {
                    templateString += `<div class="vMixStatus vMixStatusEnabled ${status}">${status.toUpperCase()}: </div>`;
                } else {
                    templateString += `<div class="vMixStatus ${status}">${status.toUpperCase()}: </div>`;
                }
            });
            templateString += `
                </div>
            </div>
            <div class="inputTitle">${toTitleCase(obj.name)}</div>`;
            return templateString;
        }
    }
];

if (vars["Input"]) {
    vMixSettings.multiViewInput = parseFloat(vars["Input"]) - 1;
}

if (vars["Interval"]) {
    vMixSettings.refreshInterval = parseFloat(vars["Interval"]);
}

if (vars["Settings"]) {
    var parsedSettings = JSON.parse(decodeURIComponent(vars.Settings));
    parsedSettings.forEach((extra, i) => {
        Object.keys(extra).forEach(property => {
            extras[i][property] = extra[property];
        });
    });
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
var vMixInputs = [];

function log10(x) {
    return Math.log(x) * 20 || 0;
}

var vMixStatuses = [
    "recording",
    "external",
    "streaming",
    "playList",
    "multiCorder",
    "fullscreen"
];

function vMixRefresh(data) {
    lastResponse = data;
    var temporaryMultiViewOverlays = [];
    vMixSettings.previewNumber = parseFloat(data.getElementsByTagName("preview")[0].innerHTML);
    vMixSettings.programNumber = parseFloat(data.getElementsByTagName("active")[0].innerHTML);
    vMixSettings.previewKey = data.querySelector(`[number="${vMixSettings.previewNumber}"]`).getAttribute("key");
    vMixSettings.programKey = data.querySelector(`[number="${vMixSettings.programNumber}"]`).getAttribute("key");

    Array.prototype.slice.call(data.getElementsByTagName("input"), 0).forEach(function(input, i) {
        vMixInputs[i] = {};
        vMixInputs[i].title = input.getAttribute("title");
        vMixInputs[i].key = input.getAttribute("key");
        if (input.getAttribute("muted")) {
            vMixInputs[i].audio = true;
            vMixInputs[i].muted = input.getAttribute("muted") === "True";
            vMixInputs[i].audioL = log10(input.getAttribute("meterF1") * 100);
            vMixInputs[i].audioR = log10(input.getAttribute("meterF2") * 100);
        } else {
            vMixInputs[i].audio = false;
        }
        if (input.getAttribute("duration")) {
            vMixInputs[i].video = true;
            vMixInputs[i].duration = input.getAttribute("duration");
            vMixInputs[i].position = input.getAttribute("position");
        } else {
            vMixInputs[i].video = false;
        }
    });

    overlayArray = Array.prototype.slice.call(data.getElementsByTagName("input")[vMixSettings.multiViewInput].getElementsByTagName("overlay"), 0);

    if (overlayArray.length === 0) {
        $(".warning").html("No multiview layers on input " + (parseFloat(vMixSettings.multiViewInput) + 1));
        $(".warning").css("display", "flex");
    } else {
        $(".warning").css("display", "none");
    }

    for (var i = 0; i < overlayArray.length && i < 9; i++) {
        if (parseFloat(overlayArray[i].getAttribute("index")) !== 9) {
            var zoomY = 100, zoomX = 100, panY = 0, panX = 0, inputKey, inputName;
            if (overlayArray[i].getElementsByTagName("position")[0] !== undefined) {
                zoomY = parseFloat(overlayArray[i].getElementsByTagName("position")[0].getAttribute("zoomY")) * 100;
                zoomX = parseFloat(overlayArray[i].getElementsByTagName("position")[0].getAttribute("zoomX")) * 100;
                panY = parseFloat(overlayArray[i].getElementsByTagName("position")[0].getAttribute("panY")) * 100;
                panX = parseFloat(overlayArray[i].getElementsByTagName("position")[0].getAttribute("panX")) * 100;
            }
            inputKey = overlayArray[i].getAttribute("key");
            inputName = lastResponse.querySelector(`input[key="${inputKey}"]`).getAttribute("title");

            temporaryMultiViewOverlays[i] = { zoomX, zoomY, panX, panY, inputKey, inputName };
        }
    }

    var forceRefresh = false;
    vMixStatuses.forEach(status => {
        if (vMixSettings[status] !== (data.getElementsByTagName(status)[0].innerHTML === "True")) {
            vMixSettings[status] = data.getElementsByTagName(status)[0].innerHTML === "True";
            forceRefresh = true;
        }
    });

    if (JSON.stringify(temporaryMultiViewOverlays) !== JSON.stringify(multiViewOverlays) || forceRefresh) {
        multiViewOverlays = temporaryMultiViewOverlays;
        refresh();
    }
}

function generateVU(audio, overlay) {
    if (!audio || !vMixSettings.showAudioMeters) return "";

    return `
    <div class="audioMeters">
        <div class="leftAudio audioChannel" style="height: ${100 + overlay.zoomY / 100 * overlay.panY}%;">
            <div class="audioMeter audioLeft" style="height:${vMixInputs.find(input => input.key === overlay.inputKey).audioL}%;"></div>
        </div>
        <div class="rightAudio audioChannel" style="height: ${100 + overlay.zoomY / 100 * overlay.panY}%;">
            <div class="audioMeter audioRight" style="height:${vMixInputs.find(input => input.key === overlay.inputKey).audioR}%;"></div>
        </div>
    </div>`;
}

function refresh() {
    var saveArray = []
    extras.forEach((extra, i) => {
        if (saveArray[i] == undefined) {
            saveArray[i] = {}
        }
        saveSettings.forEach(setting => {
            saveArray[i][setting] = extra[setting]
        })
    });
    $("#saveURL").val("https://multiview.multicam.media?Settings=" + encodeURIComponent(JSON.stringify(saveArray)))
    clockTick();
    $(".outerContainer").html("")
    
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

    extras.forEach(extra => {
        if (extra.enabled == true) {
            $(".outerContainer").append(extra.template(extra))
        }
    });
}

function clockTick() {
    var time = new Date().toLocaleTimeString();
    $("#clock").html(time);
}
