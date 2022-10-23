var CTX;

var CONFIG = {
    "animation_timing_ms": 100,
    "none_color": "#333333",
    "grid_height": 28,
    "grid_length": 20,
    "led_size": 15,
    "led_spacing": 15
}

var animation; 
var playing = false;
var insertAtTheEnd = false;
var colorPicking = false;

/* pencil, eraser, fill */
var mode = "pencil"

/* This funciton is stolen from: https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
Written by Tim Down */
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function writeUint8(value, array) 
{
        let steps = new Uint8Array(1);
        steps[0] = value;
        array.push(steps);
}

function writeUint16(value, array) 
{
        let steps = new Uint16Array(1);
        steps[0] = value;
        array.push(steps);
}

class Animation {
    constructor(leds) {
        this.leds = leds;
        this.stepCount = 0;
        this.currentIndex = 0;
        this.playing = false;
        this.use_color = "#ffffff"
        this.colors = [{}]
    }

    clickLed(x, y) {
        for (let i = 0; i < CONFIG["grid_height"] * CONFIG["grid_length"]; i++) {

            if (this.leds[i] != null) {

                if (this.leds[i].checkCollision(x, y)) {
                    if (colorPicking) {
                        let color = this.leds[i].getColor()
                        if (color != CONFIG["none_color"]) {
                            this.setColor(color.substr(1));
                            document.getElementById("colorpicker").jscolor.fromString(color);
                            console.log("setting color", color);
                        }
                    }
                    else if (mode == "pencil") {

                        // print LED data to console - Index & Coordinates
                        var division = CONFIG['led_size'] + CONFIG['led_spacing'];
                        console.log("{ y: " + (this.leds[i].posX / division) + ", x: " + (this.leds[i].posY / division) + " }");
                        this.leds[i].setIndex(i);
                        console.log("LED Index: " +this.leds[i].getIndex());

                        this.leds[i].updateColor(this.use_color);
                        this.colors[this.currentIndex][this.use_color] = 1;
                    }
                    else if (mode == "eraser") {
                        this.leds[i].updateColor(CONFIG["none_color"]);
                    }
                    else if (mode == "fill") {
                        let color = this.leds[i].getColor();
                        for (let i = 0; i < CONFIG["grid_height"] * CONFIG["grid_length"]; i++) {
                            if (this.leds[i] != null && color == this.leds[i].getColor()) {
                                this.leds[i].updateColor(this.use_color);
                            }
                        }
                        this.colors[this.currentIndex][this.use_color] = 1;
                    }
                    else if (mode == "flood") {
                        for (let i = 0; i < CONFIG["grid_height"] * CONFIG["grid_length"]; i++) {
                            if (this.leds[i] != null) {
                                this.leds[i].updateColor(this.use_color); 
                            }
                        }
                        this.colors[this.currentIndex][this.use_color] = 1;
                    }

                    return true;
                }
            }
        }
        return false;
    }

    getLedsWithColor(index, color) {
        var led_indexes = []
        this.leds.forEach(led => {
            if (led.hasColorInState(index, color)) {
                led_indexes.push(led.getIndex());
            }
        });
        return led_indexes;
    }

    /* Data format:
    uint8: total animation steps
    ---
    uin16: numbers of colors in this step,
    ----
    uint8: r,
    uint8: g,
    uint8: b,
    uint16: number of leds in this step
    uint16 led_indexes[] 
    ---
    uint16: number of colors in this step
    -----
    uint8 r,
    uint8 g.... and so on
    */

    export() {
        let data = [];
        let totalAnimationSteps = this.stepCount + 1;

        writeUint8(totalAnimationSteps, data);

        for (var i = 0; i < totalAnimationSteps; i++) {

            let totalColorsInCurrentStep = Object.keys(this.colors[i]).length;

            if (totalColorsInCurrentStep === 0 && totalAnimationSteps === 0) {
                console.log("Nothing to export.")
                return;
            }

            writeUint16(totalColorsInCurrentStep, data);

            for (const color of Object.keys(this.colors[i])) {
                let rgb = hexToRgb(color)
                writeUint8(rgb.r, data)
                writeUint8(rgb.g, data)
                writeUint8(rgb.b, data)
                let ledsWithThisColor = this.getLedsWithColor(i, color);
                writeUint16(ledsWithThisColor.length, data)

                ledsWithThisColor.forEach(elem => {
                    writeUint16(elem, data);
                });
            }
        }

        var blob = new Blob(data, { type: "application/octet-stream" });
        var blobUrl = URL.createObjectURL(blob);
        window.location.replace(blobUrl);

        var fileLink = document.createElement('a');
        fileLink.href = blobUrl
        fileLink.download = "animation.bin"
        fileLink.click();

    }

    saveToJsonFile() {
        let data = {};
        data.leds = this.leds;
        data.stepCount = this.stepCount;
        data.currentIndex = this.currentIndex;
        data.colors = this.colors;
        data.use_color = this.use_color;
        const dataJson = JSON.stringify(data);
        var blob = new Blob([dataJson], { type: "application/octet-stream" });
        var blobUrl = URL.createObjectURL(blob);
        window.location.replace(blobUrl);

        var fileLink = document.createElement('a');
        fileLink.href = blobUrl
        fileLink.download = "animation.json"
        fileLink.click();
    }

    loadFromJsonFile(jsonString) {
        this.playing = false;
        var data = null;
        try {
            data = JSON.parse(jsonString);
        } catch (e) {
            return false;
        }
        if (!data) {
            return false;
        }
        clearAll();
        var newLeds = [];
        data.leds.forEach(led => {
            var newLed = new Led(led.x, led.y);
            newLed.colorState = led.colorState;
            newLed.currentState = led.currentState;
            newLed.size = led.size;
            newLed.spacing = led.spacing;
            newLed.posX = led.posX;
            newLed.posY = led.posY;
            newLeds.push(newLed);
        });

        this.leds = newLeds;
        this.stepCount = data.stepCount;
        this.currentIndex = data.currentIndex;
        this.colors = data.colors;
        this.use_color = data.use_color;
        this.currentState = 0
        this.update();

        this.setColor(data.use_color.substr(1));
        document.getElementById("colorpicker").jscolor.fromString(data.use_color);
        return true;
    }

    update() {
        this.updateLedState();
        this.draw();
    }

    insertStep() {
        this.leds.forEach(led => {
            led.insert();
        });
    }
    newStep(copy = false) {
        this.stepCount++;
        var previousIndex = this.currentIndex;
        if (insertAtTheEnd) {
            this.currentIndex = this.stepCount;
            this.colors.push({});
        } else {
            this.currentIndex++;
            this.colors.splice(this.currentIndex, 0, {});
            this.insertStep();
        }

        this.update();

        if (copy && this.stepCount > 0) {
            for (const color of Object.keys(this.colors[previousIndex])) {
                this.colors[this.currentIndex][color] = 1;
            }

            this.leds.forEach(led => {
                led.copyIndex(previousIndex);
            });
        }
        this.update();
    }

    stepForward() {
        if (this.currentIndex < this.stepCount) {
            this.currentIndex++;
        }
        else {
            this.currentIndex = 0;
        }
        this.update();
    }


    clearAll() 
    {
        this.leds.forEach(led => {
            led.updateColor(CONFIG["none_color"]);
        });
        this.update();
    }
    stepBackward() 
    {
        this.currentIndex--;
        if (this.currentIndex < 0)
            this.currentIndex = 0;
        this.update();
    }

    updateLedState() 
    {
        this.leds.forEach(led => {
            led.updateState(this.currentIndex)
        });
    }

    animationStep() 
    {

        if (this.stepCount == 0) 
        {
            this.stop();
            return;
        }
        this.currentIndex++;
        this.currentIndex = (this.currentIndex % (this.stepCount + 1))
        this.update();
    }
    
    setColor(color)
    {
        this.use_color = "#" + color;
    }

    play() 
    {
        if (!playing) {
            playing = true;
            this.playingInterval = setInterval(() => {this.animationStep()}, CONFIG["animation_timing_ms"]);
        }
    }
     
    stop() 
    {
        playing = false;
        clearTimeout(this.playingInterval);
        this.update();
    }
    
    deleteStep() 
    {
         if (this.stepCount > 0)   {
             this.leds.forEach(led => {
                led.removeStep(this.currentIndex);
                led.updateState(this.currentIndex - 1);
            
             });
             this.colors.splice(this.currentIndex, 1);
             if (this.currentIndex != 0)
                this.currentIndex--;
             this.stepCount--;
             this.update();
         }
    }

    startDraw()
    {
        /*
        for (let i = 0; i < CONFIG["grid_height"] * CONFIG["grid_length"]; i++) {
            if (this.leds[i] != null) {
                this.leds[i].updateColor('#000000');
                this.colors[this.currentIndex]['#000000'] = 1;
            }
        }
        */

        this.draw();
    }
    
    draw() 
    {
        clearCanvas()
        updateCurrentStep()
        updateTotalSteps()
        this.leds.forEach(led => {
           led.draw(); 
        });
    }

}



class Led 
{
    constructor(x, y) 
    {
        this.x = x;
        this.y = y;
        this.colorState = [CONFIG["none_color"]]
        this.currentState = 0;
        this.size = CONFIG["led_size"]
        this.spacing = CONFIG["led_spacing"]
        this.posX = this.x * this.size + this.x * this.spacing;
        this.posY = this.y * this.size + this.y * this.spacing;
        this.index = 0;
    }

    removeStep(idx) {
        this.colorState.splice(idx, 1)
    }
    hasColorInState(state, color) {
        return this.colorState[state] == color;
    }

    getColor() 
    {
        return this.colorState[this.currentState];
    }

    setIndex(i)
    {
        this.index = i;
    }

    getIndex()
    {
        // return this.y * CONFIG["grid_length"] + this.x;
        return this.index;
    }

    insert() {
        this.colorState.splice(this.currentState + 1, 0,  CONFIG["none_color"]);
    }

    copyIndex(idx) 
    {
        this.colorState[this.currentState] = this.colorState[idx];
    }

    checkCollision(x, y) 
    {
        return (x >= this.posX && x <= this.posX + this.size && y >= this.posY && y <= this.posY + this.size)
    }

    updateColor(color) 
    {
        this.colorState[this.currentState] = color;
    }

    updateState(step) 
    {
        this.currentState = step;
        if (step == this.colorState.length) {
            this.colorState.push(CONFIG["none_color"])
        }
    }

    draw() 
    {
        if (this.colorState[this.currentState - 1] != CONFIG["none_color"] && this.colorState[this.currentState] == CONFIG["none_color"] && this.currentState != 0 && !playing) {
            CTX.fillStyle = this.colorState[this.currentState - 1];
            CTX.globalAlpha = 0.3;
            CTX.shadowBlur = 0;
        }
        else {

            CTX.fillStyle = this.colorState[this.currentState];
            CTX.shadowColor = this.colorState[this.currentState];
            CTX.globalAlpha = 1;
            CTX.shadowBlur = 20;
        }

        CTX.beginPath();
        CTX.fillRect(this.x * this.size + this.x * this.spacing, this.y * this.size + this.y * this.spacing, this.size, this.size);
        CTX.stroke();
    }

    drawShadow() {
        CTX.beginPath();
        CTX.fillStyle = this.colorState[this.currentState];
        CTX.shadowBlur = 20;
        CTX.shadowColor = this.colorState[this.currentState];
        CTX.fillRect(this.x * this.size + this.x * this.spacing, this.y * this.size + this.y * this.spacing, this.size, this.size);
        CTX.stroke();
    }
}


function clearCanvas() 
{
    CTX.clearRect(0, 0, canvas.width, canvas.height);
}

function updateCurrentStep() 
{
    $(".totalSteps").each(function() {
        this.innerHTML = animation.stepCount + 1;
    })
}

function updateTotalSteps() 
{
    $(".currentStep").each(function() {
        this.innerHTML = animation.currentIndex + 1;
    })
}
function startDraw()
{
    var mouse_down = false;
    var c = document.getElementById("canvas");
    CTX = c.getContext("2d");
    var leds = [];


    let index = 0;
    for (i = 0; i < CONFIG["grid_height"]; i++) 
    {
        for (j = 0; j < CONFIG["grid_length"]; j++) {

            // add blanks
            let blank = false;

            for (k = 0; k < blanks.length; k++) {
                if (blanks[k].x == i && blanks[k].y == j) {
                    blank = true;
                }
            }

            if (!blank) {
                led = new Led(j, i);
                leds.push(led);
            }
        }
    }

    animation = new Animation(leds);
    animation.startDraw();

    c.onclick = function(e) 
    { 
        if (animation.clickLed(e.offsetX, e.offsetY) ) 
        {
            animation.draw();
        }
    }

    c.onmousedown = function(e)
    {
        mouse_down = true;
    }

    c.onmousemove = function(e)
    {
        if (mouse_down) 
        {
            if (animation.clickLed(e.offsetX, e.offsetY) ) 
            {
                clearCanvas()
                animation.draw();
            }
        }
    }
    c.onmouseup = function(e) 
    {
        mouse_down = false;
    }
}

function stepForward() 
{
    animation.stepForward();
}

function stepBackward() 
{
    animation.stepBackward();
}

function play() 
{
    animation.play();
}

function stop()
{
    animation.stop();
}

function setColor(color) 
{
    animation.setColor(color);
}

function setMode(m) 
{
    colorPicking = false;
    mode = m
    if (mode == "pencil") {
        $('#canvas').css({'cursor': "url('pencilsmall.png') -10 40, pointer"});
    }
    else if (mode == "eraser") {
        $('#canvas').css({'cursor': "url('erasersmall.png') -10 40, pointer"});
    }
    else if (mode == "fill") {
        $('#canvas').css({ 'cursor': "url('bucketsmall.png') 25 40, pointer" });
    }
    else if (mode == "flood") {
        $('#canvas').css({ 'cursor': "url('bucketsmall.png') 25 40, pointer" });
    }
}


function fillAll() {
    animation.fillAll();
}


function clearAll() {
    animation.clearAll()
}

function exportFormat() {
    animation.export();
}

function saveToJsonFile() {
    animation.saveToJsonFile();
}

function loadFromJsonFile(jsonString) {
    return animation.loadFromJsonFile(jsonString);
}

function removeStep() {
    animation.deleteStep();
}

function newStep() {
    animation.newStep();
}

function copyStep() {
    animation.newStep(true)
}

function insertAfter(v){
    insertAtTheEnd = v;
}

function colorPick(v) {
    colorPicking = v;
    if (colorPicking) {
        $('#canvas').css({'cursor': "url('eyedropper.png') -10 40, pointer"});
    }
    else {
        setMode(mode);
    }
}

function readFile(file) {     
    const reader = new FileReader();
    reader.addEventListener('load', (event) => {
        const result = event.target.result;
        var loadResult = loadFromJsonFile(result);
        const output = document.getElementById('output');
        const li = document.createElement('li');
        if (loadResult){
            li.textContent = `Loaded animation file!`;
            output.appendChild(li);
        }
        else{
            li.textContent = `Failed to load backup animation file :(  Was it a .json file?`;
            output.appendChild(li);
        }
    });
    reader.readAsText(file);
}

function attachFileLoaderHandler(){
    const output = document.getElementById('output');
    if (window.FileList && window.File) {
        document.getElementById('file-selector').addEventListener('change', event => {
            output.innerHTML = '';
            for (const file of event.target.files) {
                const li = document.createElement('li');
                const name = file.name ? file.name : 'NOT SUPPORTED';
                //const type = file.type ? file.type : 'NOT SUPPORTED';
                const size = file.size ? file.size : 'NOT SUPPORTED';
                li.textContent = `File name: ${name}, size: ${size}`;
                output.appendChild(li);
                readFile(file);
            }
        }); 
    }
}


const blanks = [
    // OUTLINE
    { y: 0, x: 0 },
    { y: 0, x: 1 },
    { y: 0, x: 2 },
    { y: 0, x: 3 },
    { y: 0, x: 4 },
    { y: 0, x: 5 },
    { y: 0, x: 6 },
    { y: 0, x: 18 },
    { y: 0, x: 19 },
    { y: 0, x: 20 },
    { y: 0, x: 21 },
    { y: 0, x: 22 },
    { y: 0, x: 23 },
    { y: 0, x: 23 },
    { y: 0, x: 24 },
    { y: 0, x: 25 },
    { y: 0, x: 26 },
    { y: 0, x: 27 },
    { y: 1, x: 0 },
    { y: 1, x: 1 },
    { y: 1, x: 2 },
    { y: 1, x: 3 },
    { y: 1, x: 21 },
    { y: 1, x: 22 },
    { y: 1, x: 23 },
    { y: 1, x: 24 },
    { y: 1, x: 25 },
    { y: 1, x: 26 },
    { y: 1, x: 27 },
    { y: 2, x: 0 },
    { y: 2, x: 1 },
    { y: 2, x: 2 },
    { y: 2, x: 23 },
    { y: 2, x: 24 },
    { y: 2, x: 25 },
    { y: 2, x: 26 },
    { y: 2, x: 27 },
    { y: 3, x: 0 },
    { y: 3, x: 1 },
    { y: 3, x: 25 },
    { y: 3, x: 26 },
    { y: 3, x: 27 },
    { y: 4, x: 0 },
    { y: 4, x: 1 },
    { y: 4, x: 26 },
    { y: 4, x: 27 },
    { y: 5, x: 0 },
    { y: 5, x: 27 },
    { y: 6, x: 0 },
    { y: 6, x: 27 },
    { y: 13, x: 0 },
    { y: 13, x: 27 },
    { y: 14, x: 0 },
    { y: 14, x: 27 },
    { y: 15, x: 0 },
    { y: 15, x: 1 },
    { y: 15, x: 26 },
    { y: 15, x: 27 },
    { y: 16, x: 0 },
    { y: 16, x: 1 },
    { y: 16, x: 25 },
    { y: 16, x: 26 },
    { y: 16, x: 27 },
    { y: 17, x: 0 },
    { y: 17, x: 1 },
    { y: 17, x: 1 },
    { y: 17, x: 2 },
    { y: 17, x: 23 },
    { y: 17, x: 24 },
    { y: 17, x: 25 },
    { y: 17, x: 26 },
    { y: 17, x: 27 },
    { y: 18, x: 0 },
    { y: 18, x: 1 },
    { y: 18, x: 2 },
    { y: 18, x: 3 },
    { y: 18, x: 21 },
    { y: 18, x: 22 },
    { y: 18, x: 23 },
    { y: 18, x: 24 },
    { y: 18, x: 25 },
    { y: 18, x: 26 },
    { y: 18, x: 26 },
    { y: 18, x: 27 },
    { y: 19, x: 0 },
    { y: 19, x: 1 },
    { y: 19, x: 2 },
    { y: 19, x: 3 },
    { y: 19, x: 4 },
    { y: 19, x: 4 },
    { y: 19, x: 5 },
    { y: 19, x: 5 },
    { y: 19, x: 6 },
    { y: 19, x: 18 },
    { y: 19, x: 19 },
    { y: 19, x: 20 },
    { y: 19, x: 20 },
    { y: 19, x: 21 },
    { y: 19, x: 21 },
    { y: 19, x: 22 },
    { y: 19, x: 22 },
    { y: 19, x: 23 },
    { y: 19, x: 24 },
    { y: 19, x: 24 },
    { y: 19, x: 25 },
    { y: 19, x: 26 },
    { y: 19, x: 27 },
    { y: 3, x: 24 },
    { y: 4, x: 25 },
    { y: 5, x: 26 },
    { y: 6, x: 26 },
    { y: 7, x: 27 },
    { y: 7, x: 27 },
    { y: 8, x: 27 },
    { y: 8, x: 27 },
    { y: 9, x: 27 },
    { y: 10, x: 27 },
    { y: 11, x: 27 },
    { y: 12, x: 27 },
    { y: 13, x: 26 },
    { y: 13, x: 26 },
    { y: 14, x: 26 },
    { y: 15, x: 25 },
    { y: 16, x: 24 },
    // EYES
    { y: 4, x: 10 },
    { y: 5, x: 10 },
    { y: 6, x: 10 },
    { y: 13, x: 10 },
    { y: 14, x: 10 },
    { y: 15, x: 10 },
    { y: 15, x: 10 },
    { y: 3, x: 11 },
    { y: 4, x: 11 },
    { y: 5, x: 11 },
    { y: 6, x: 11 },
    { y: 7, x: 11 },
    { y: 12, x: 11 },
    { y: 13, x: 11 },
    { y: 13, x: 11 },
    { y: 14, x: 11 },
    { y: 14, x: 11 },
    { y: 15, x: 11 },
    { y: 16, x: 11 },
];

