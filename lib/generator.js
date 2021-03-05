var exec = require("platform-command").exec;
var fs = require("fs");
var Mustache = require("mustache");
var async = require("async");
var os = require("os");
var path = require("path");
var crypto = require("crypto");
var tinify = require("tinify");
var ora = require("ora");
var spinnerSettings = {
  build: "Building image processing...",
  tinify: "TinyPNG processing...",
  spinner: {
    interval: 80,
    frames: [
      "[          ]",
      "[>         ]",
      "[=>        ]",
      "[==>       ]",
      "[===>      ]",
      "[====>     ]",
      "[=====>    ]",
      "[======>   ]",
      "[=======>  ]",
      "[========> ]",
      "[=========>]",
      "[ =========]",
      "[  ========]",
      "[   =======]",
      "[    ======]",
      "[     =====]",
      "[      ====]",
      "[       ===]",
      "[        ==]",
      "[         =]",
    ],
  },
};

const TINIPNG_API_KEY = process.env.TINIPNG_API_KEY;

var packing = require("./packing/packing.js");
var sorter = require("./sorter/sorter.js");

/**
 * Generate temporary trimmed image files
 * @param {string[]} files
 * @param {object} options
 * @param {string} options.scale image resize
 * @param {string} options.fuzz image fuzz
 * @param {boolean} options.trim is trimming enabled
 * @param callback
 */
exports.treatImages = function (files, options, callback) {
  // if (!options.trim) return callback(null);

  var uuid = crypto.randomBytes(16).toString("hex");
  var i = 0;
  async.eachSeries(
    files,
    function (file, next) {
      file.originalPath = file.path;
      i++;
      file.path = path.join(
        os.tmpdir(),
        "spritesheet_js_" + uuid + "_" + new Date().getTime() + "_image_" + i + ".png",
      );

      var resize = options.scale ? " -resize " + options.scale : "";
      var fuzz = options.fuzz ? " -fuzz " + options.fuzz : "";
      //have to add 1px transparent border because imagemagick does trimming based on border pixel's color
      var trim = options.trim ? " -bordercolor transparent -border 1 -trim " : "";
      var command =
        "convert" +
        fuzz +
        ' -define png:exclude-chunks=date "' +
        file.originalPath +
        '"' +
        trim +
        "" +
        resize +
        ' "' +
        file.path +
        '"';
      exec(command, next);
    },
    callback,
  );
};

/**
 * Iterates through given files and gets its size
 * @param {string[]} files
 * @param {object} options
 * @param {boolean} options.trim is trimming enabled
 * @param {function} callback
 */
exports.getImagesSizes = function (files, options, callback) {
  var filePaths = files.map(function (file) {
    return '"' + file.path + '"';
  });
  exec("identify " + filePaths.join(" "), function (err, stdout) {
    if (err) return callback(err);

    var sizes = stdout.split("\n");
    sizes = sizes.splice(0, sizes.length - 1);
    sizes.forEach(function (item, i) {
      var size = item.match(/ ([0-9]+)x([0-9]+) /);
      files[i].width = parseInt(size[1], 10) + options.padding * 2;
      files[i].height = parseInt(size[2], 10) + options.padding * 2;
      var forceTrimmed = false;
      if (options.divisibleByTwo) {
        if (files[i].width & 1) {
          files[i].width += 1;
          forceTrimmed = true;
        }
        if (files[i].height & 1) {
          files[i].height += 1;
          forceTrimmed = true;
        }
      }
      files[i].area = files[i].width * files[i].height;
      files[i].trimmed = false;

      if (options.trim) {
        var rect = item.match(/ ([0-9]+)x([0-9]+)[\+\-]([0-9]+)[\+\-]([0-9]+) /);
        files[i].trim = {};
        files[i].trim.x = parseInt(rect[3], 10) - 1;
        files[i].trim.y = parseInt(rect[4], 10) - 1;
        files[i].trim.width = parseInt(rect[1], 10) - 2;
        files[i].trim.height = parseInt(rect[2], 10) - 2;

        files[i].trimmed =
          forceTrimmed ||
          (files[i].trim.width !== files[i].width - options.padding * 2 ||
            files[i].trim.height !== files[i].height - options.padding * 2);
      }
    });
    callback(null, files);
  });
};

/**
 * Determines texture size using selected algorithm
 * @param {object[]} files
 * @param {object} options
 * @param {object} options.algorithm (growing-binpacking, binpacking, vertical, horizontal)
 * @param {object} options.square canvas width and height should be equal
 * @param {object} options.powerOfTwo canvas width and height should be power of two
 * @param {function} callback
 */
exports.determineCanvasSize = function (files, options, callback) {
  files.forEach(function (item) {
    item.w = item.width;
    item.h = item.height;
  });

  // sort files based on the choosen options.sort method
  sorter.run(options.sort, files);

  packing.pack(options.algorithm, files, options);

  if (options.square) {
    options.width = options.height = Math.max(options.width, options.height);
  }

  if (options.powerOfTwo) {
    options.width = roundToPowerOfTwo(options.width);
    options.height = roundToPowerOfTwo(options.height);
  }

  callback(null, options);
};

/**
 * generates texture data file
 * @param {object[]} files
 * @param {object} options
 * @param {string} options.path path to image file
 * @param {function} callback
 */
exports.generateImage = function (files, options, callback) {
  var spinner = ora({ text: spinnerSettings.build, spinner: spinnerSettings.spinner });
  spinner.start();

  var command = [
    "convert -define png:exclude-chunks=date -quality 0% -size " + options.width + "x" + options.height + " xc:none",
  ];
  files.forEach(function (file) {
    command.push(
      '"' + file.path + '" -geometry +' + (file.x + options.padding) + "+" + (file.y + options.padding) + " -composite",
    );
  });
  var filePath = options.path + "/" + options.name + ".png";
  command.push('"' + filePath + '"');
  exec(command.join(" "), function (err) {
    if (err) {
      spinner.fail("Spritesheet build fails...");
      return callback(err);
    }

    function getImageInfos(filePath) {
      return new Promise(function (resolve) {
        exec("magick identify " + filePath, function (err, stdout) {
          if (err) {
            infos = "unable to retrieve infos...";
          }
          else {
            params = stdout.split(" ");
            infos = [
              // "format: " + params[1],
              "format: " + options.format,
              "size: " + params[2],
              "weight: " + params[6],
            ].join(" / ");
          }
          resolve(infos);
        });
      });
    }

    return getImageInfos(filePath).then(function (infos) {
      spinner.succeed("YEAH! Spritesheet successfully generated! " + infos);

      files.forEach(function (file) {
        if (file.originalPath && file.originalPath !== file.path) {
          fs.unlinkSync(file.path.replace(/\\ /g, " "));
        }
      });

      var tinipngApiKey = TINIPNG_API_KEY || options.tinify;

      if (tinipngApiKey) {
        spinner = ora({ text: spinnerSettings.tinify, spinner: spinnerSettings.spinner });
        spinner.start();

        // var filePathOptimized = filePath.replace('.png', '-optimized.png');
        // tinify
        //   .fromFile(filePath)
        //   .toFile(filePathOptimized).then(function() {}
        tinify.key = tinipngApiKey;
        return tinify.fromFile(filePath).toFile(filePath).then(
          function () {
            return getImageInfos(filePath).then(function (infos) {
              spinner.succeed("WOOOOW! Spritesheet successfully tinified! " + infos);
              return callback(null);
            });
          },
          function (err) {
            message = err;
            if (err instanceof tinify.AccountError) {
              message = err.message;
            }
            else if (err instanceof tinify.ClientError) {
              // Check your source image and request options.
              message = "tinify: generated image seems to be the problem";
            }
            else if (err instanceof tinify.ServerError) {
              // Temporary issue with the Tinify API.
              message = "tinify: issue with the API";
            }
            else if (err instanceof tinify.ConnectionError) {
              // A network connection error occurred.
              message = "tinify: network connection error";
            }
            spinner.fail("Sorry tinification fails...");
            return callback(message);
          },
        );
      }
      else {
        return callback(null);
      }
    });
  });
};

/**
 * generates texture data file
 * @param {object[]} files
 * @param {object} options
 * @param {string} options.path path to data file
 * @param {string} options.dataFile data file name
 * @param {function} callback
 */
exports.generateData = function (files, options, callback) {
  var formats = (Array.isArray(options.customFormat)
    ? options.customFormat
    : [
      options.customFormat,
    ]).concat(
      Array.isArray(options.format)
        ? options.format
        : [
          options.format,
        ],
    );
  formats.forEach(function (format, i) {
    if (!format) return;
    var path = typeof format === "string" ? format : __dirname + "/../templates/" + format.template;
    var templateContent = fs.readFileSync(path, "utf-8");
    var cssPriority = 0;
    var cssPriorityNormal = cssPriority++;
    var cssPriorityHover = cssPriority++;
    var cssPriorityActive = cssPriority++;

    // sort files based on the choosen options.sort method
    sorter.run(options.sort, files);

    options.files = files;
    options.files.forEach(function (item, i) {
      item.spritesheetWidth = options.width;
      item.spritesheetHeight = options.height;
      item.width -= options.padding * 2;
      item.height -= options.padding * 2;
      item.x += options.padding;
      item.y += options.padding;

      item.index = i;
      if (item.trim) {
        item.trim.frameX = -item.trim.x;
        item.trim.frameY = -item.trim.y;
        item.trim.offsetX = Math.floor(Math.abs(item.trim.x + item.width / 2 - item.trim.width / 2));
        item.trim.offsetY = Math.floor(Math.abs(item.trim.y + item.height / 2 - item.trim.height / 2));
      }
      item.cssName = item.name || "";
      if (item.cssName.indexOf("_hover") >= 0) {
        item.cssName = item.cssName.replace("_hover", ":hover");
        item.cssPriority = cssPriorityHover;
      }
      else if (item.cssName.indexOf("_active") >= 0) {
        item.cssName = item.cssName.replace("_active", ":active");
        item.cssPriority = cssPriorityActive;
      }
      else {
        item.cssPriority = cssPriorityNormal;
      }
    });

    function getIndexOfCssName(files, cssName) {
      for (var i = 0; i < files.length; ++i) {
        if (files[i].cssName === cssName) {
          return i;
        }
      }
      return -1;
    }

    if (options.cssOrder) {
      var order = options.cssOrder.replace(/\./g, "").split(",");
      order.forEach(function (cssName) {
        var index = getIndexOfCssName(files, cssName);
        if (index >= 0) {
          files[index].cssPriority = cssPriority++;
        }
        else {
          console.warn("could not find :" + cssName + "css name");
        }
      });
    }

    options.files.sort(function (a, b) {
      return a.cssPriority - b.cssPriority;
    });

    options.files[options.files.length - 1].isLast = true;

    var result = Mustache.render(templateContent, options);
    function findPriority(property) {
      var value = options[property];
      var isArray = Array.isArray(value);
      if (isArray) {
        return i < value.length ? value[i] : format[property] || value[0];
      }
      return format[property] || value;
    }
    fs.writeFile(findPriority("path") + "/" + findPriority("name") + "." + findPriority("extension"), result, callback);
  });
};

/**
 * Rounds a given number to to next number which is power of two
 * @param {number} value number to be rounded
 * @return {number} rounded number
 */
function roundToPowerOfTwo(value) {
  var powers = 2;
  while (value > powers) {
    powers *= 2;
  }

  return powers;
}
