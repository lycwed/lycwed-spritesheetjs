# ![spritesheet.js](http://i.imgur.com/RcHZ2qZ.png)

Spritesheet.js is command-line spritesheet (a.k.a. Texture Atlas) generator written in Node.js.

`NEW: add tinyPNG API support by passing --tinify=YOUR_API_KEY`

## Supported Spritesheet Formats

* JSON
* PIXI.js (= JSON with trim enabled)
* Starling / Sparrow
* Easel.js
* cocos2d (i.e. version 2.x)
* cocos2d-v3 (i.e. version 3.x)
* CSS (new!)

## Installation

1. Install [ImageMagick](http://www.imagemagick.org/) (on macos use `brew install imagemagick`)
2. Install Spritesheet.js globally:

    ```bash
    npm install -g lycwed-spritesheetjs
    ```

## Usage

### Command Line

```bash
spritesheet-js assets/*.png
```

Options:

```bash
$ spritesheet-js
Usage: spritesheet-js [options] <files>

Options:
-f, --format  format of spritesheet (starling, sparrow, json, pixi.js, easel.js, cocos2d)                                                          [default: "json"]
-n, --name    name of generated spritesheet                                                                                                        [default: "spritesheet"]
-p, --path    path to export directory                                                                                                             [default: "."]
--fullpath    include path in file name                                                                                                            [default: false]
--prefix      prefix for image paths (css format only)                                                                                             [default: ""]
--trim        removes transparent whitespaces around images                                                                                        [default: false]
--square      texture should be s square                                                                                                           [default: false]
--powerOfTwo  texture width and height should be power of two                                                                                      [default: false]
--validate    check algorithm returned data                                                                                                        [default: false]
--algorithm   packing algorithm: growing-binpacking (default), binpacking (requires passing --width and --height options), vertical or horizontal  [default: "growing-binpacking"]
--width       width for binpacking                                                                                                                 [default: null]
--height      height for binpacking                                                                                                                [default: null]
--padding     padding between images in spritesheet                                                                                                [default: 0]
--scale       percentage scale, ex: 50%                                                                                                            [default: null]
--fuzz        percentage fuzz factor (usually value of 1% is a good choice)                                                                        [default: null]
--tinify      TinyPNG API key                                                                                                                      [default: null]

```

### Node.js

```javascript
var spritesheet = require("lycwed-spritesheetjs");

spritesheet("assets/*.png", { format: "json" }, function(err) {
    if (err) throw err;

    console.log("spritesheet successfully generated");
});
```

## Trimming / Cropping

Spritesheet.js can remove transparent whitespace around images. Thanks to that you can pack more assets into one spritesheet and it makes rendering a little bit faster.

_NOTE: Some libraries such as Easel.js dont't support this feature._
![Trimming / Cropping](http://i.imgur.com/76OokJU.png)

## Test

```bash
npm run test
```

## Credits

Thanks [Przemysław Piekarski](http://www.behance.net/piekarski) for logo design and assets in examples.