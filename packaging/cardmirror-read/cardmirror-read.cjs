"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/fast-xml-parser/src/util.js
var require_util = __commonJS({
  "node_modules/fast-xml-parser/src/util.js"(exports2) {
    "use strict";
    var nameStartChar = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
    var nameChar = nameStartChar + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
    var nameRegexp = "[" + nameStartChar + "][" + nameChar + "]*";
    var regexName = new RegExp("^" + nameRegexp + "$");
    var getAllMatches = function(string, regex) {
      const matches = [];
      let match = regex.exec(string);
      while (match) {
        const allmatches = [];
        allmatches.startIndex = regex.lastIndex - match[0].length;
        const len = match.length;
        for (let index = 0; index < len; index++) {
          allmatches.push(match[index]);
        }
        matches.push(allmatches);
        match = regex.exec(string);
      }
      return matches;
    };
    var isName = function(string) {
      const match = regexName.exec(string);
      return !(match === null || typeof match === "undefined");
    };
    exports2.isExist = function(v) {
      return typeof v !== "undefined";
    };
    exports2.isEmptyObject = function(obj) {
      return Object.keys(obj).length === 0;
    };
    exports2.merge = function(target, a, arrayMode) {
      if (a) {
        const keys2 = Object.keys(a);
        const len = keys2.length;
        for (let i = 0; i < len; i++) {
          if (arrayMode === "strict") {
            target[keys2[i]] = [a[keys2[i]]];
          } else {
            target[keys2[i]] = a[keys2[i]];
          }
        }
      }
    };
    exports2.getValue = function(v) {
      if (exports2.isExist(v)) {
        return v;
      } else {
        return "";
      }
    };
    var DANGEROUS_PROPERTY_NAMES = [
      // '__proto__',
      // 'constructor',
      // 'prototype',
      "hasOwnProperty",
      "toString",
      "valueOf",
      "__defineGetter__",
      "__defineSetter__",
      "__lookupGetter__",
      "__lookupSetter__"
    ];
    var criticalProperties = ["__proto__", "constructor", "prototype"];
    exports2.isName = isName;
    exports2.getAllMatches = getAllMatches;
    exports2.nameRegexp = nameRegexp;
    exports2.DANGEROUS_PROPERTY_NAMES = DANGEROUS_PROPERTY_NAMES;
    exports2.criticalProperties = criticalProperties;
  }
});

// node_modules/fast-xml-parser/src/validator.js
var require_validator = __commonJS({
  "node_modules/fast-xml-parser/src/validator.js"(exports2) {
    "use strict";
    var util = require_util();
    var defaultOptions = {
      allowBooleanAttributes: false,
      //A tag can have attributes without any value
      unpairedTags: []
    };
    exports2.validate = function(xmlData, options) {
      options = Object.assign({}, defaultOptions, options);
      const tags = [];
      let tagFound = false;
      let reachedRoot = false;
      if (xmlData[0] === "\uFEFF") {
        xmlData = xmlData.substr(1);
      }
      for (let i = 0; i < xmlData.length; i++) {
        if (xmlData[i] === "<" && xmlData[i + 1] === "?") {
          i += 2;
          i = readPI(xmlData, i);
          if (i.err) return i;
        } else if (xmlData[i] === "<") {
          let tagStartPos = i;
          i++;
          if (xmlData[i] === "!") {
            i = readCommentAndCDATA(xmlData, i);
            continue;
          } else {
            let closingTag = false;
            if (xmlData[i] === "/") {
              closingTag = true;
              i++;
            }
            let tagName = "";
            for (; i < xmlData.length && xmlData[i] !== ">" && xmlData[i] !== " " && xmlData[i] !== "	" && xmlData[i] !== "\n" && xmlData[i] !== "\r"; i++) {
              tagName += xmlData[i];
            }
            tagName = tagName.trim();
            if (tagName[tagName.length - 1] === "/") {
              tagName = tagName.substring(0, tagName.length - 1);
              i--;
            }
            if (!validateTagName(tagName)) {
              let msg;
              if (tagName.trim().length === 0) {
                msg = "Invalid space after '<'.";
              } else {
                msg = "Tag '" + tagName + "' is an invalid name.";
              }
              return getErrorObject("InvalidTag", msg, getLineNumberForPosition(xmlData, i));
            }
            const result = readAttributeStr(xmlData, i);
            if (result === false) {
              return getErrorObject("InvalidAttr", "Attributes for '" + tagName + "' have open quote.", getLineNumberForPosition(xmlData, i));
            }
            let attrStr = result.value;
            i = result.index;
            if (attrStr[attrStr.length - 1] === "/") {
              const attrStrStart = i - attrStr.length;
              attrStr = attrStr.substring(0, attrStr.length - 1);
              const isValid = validateAttributeString(attrStr, options);
              if (isValid === true) {
                tagFound = true;
              } else {
                return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
              }
            } else if (closingTag) {
              if (!result.tagClosed) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
              } else if (attrStr.trim().length > 0) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
              } else if (tags.length === 0) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' has not been opened.", getLineNumberForPosition(xmlData, tagStartPos));
              } else {
                const otg = tags.pop();
                if (tagName !== otg.tagName) {
                  let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
                  return getErrorObject(
                    "InvalidTag",
                    "Expected closing tag '" + otg.tagName + "' (opened in line " + openPos.line + ", col " + openPos.col + ") instead of closing tag '" + tagName + "'.",
                    getLineNumberForPosition(xmlData, tagStartPos)
                  );
                }
                if (tags.length == 0) {
                  reachedRoot = true;
                }
              }
            } else {
              const isValid = validateAttributeString(attrStr, options);
              if (isValid !== true) {
                return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
              }
              if (reachedRoot === true) {
                return getErrorObject("InvalidXml", "Multiple possible root nodes found.", getLineNumberForPosition(xmlData, i));
              } else if (options.unpairedTags.indexOf(tagName) !== -1) {
              } else {
                tags.push({ tagName, tagStartPos });
              }
              tagFound = true;
            }
            for (i++; i < xmlData.length; i++) {
              if (xmlData[i] === "<") {
                if (xmlData[i + 1] === "!") {
                  i++;
                  i = readCommentAndCDATA(xmlData, i);
                  continue;
                } else if (xmlData[i + 1] === "?") {
                  i = readPI(xmlData, ++i);
                  if (i.err) return i;
                } else {
                  break;
                }
              } else if (xmlData[i] === "&") {
                const afterAmp = validateAmpersand(xmlData, i);
                if (afterAmp == -1)
                  return getErrorObject("InvalidChar", "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
                i = afterAmp;
              } else {
                if (reachedRoot === true && !isWhiteSpace(xmlData[i])) {
                  return getErrorObject("InvalidXml", "Extra text at the end", getLineNumberForPosition(xmlData, i));
                }
              }
            }
            if (xmlData[i] === "<") {
              i--;
            }
          }
        } else {
          if (isWhiteSpace(xmlData[i])) {
            continue;
          }
          return getErrorObject("InvalidChar", "char '" + xmlData[i] + "' is not expected.", getLineNumberForPosition(xmlData, i));
        }
      }
      if (!tagFound) {
        return getErrorObject("InvalidXml", "Start tag expected.", 1);
      } else if (tags.length == 1) {
        return getErrorObject("InvalidTag", "Unclosed tag '" + tags[0].tagName + "'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
      } else if (tags.length > 0) {
        return getErrorObject("InvalidXml", "Invalid '" + JSON.stringify(tags.map((t) => t.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 });
      }
      return true;
    };
    function isWhiteSpace(char) {
      return char === " " || char === "	" || char === "\n" || char === "\r";
    }
    function readPI(xmlData, i) {
      const start = i;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] == "?" || xmlData[i] == " ") {
          const tagname = xmlData.substr(start, i - start);
          if (i > 5 && tagname === "xml") {
            return getErrorObject("InvalidXml", "XML declaration allowed only at the start of the document.", getLineNumberForPosition(xmlData, i));
          } else if (xmlData[i] == "?" && xmlData[i + 1] == ">") {
            i++;
            break;
          } else {
            continue;
          }
        }
      }
      return i;
    }
    function readCommentAndCDATA(xmlData, i) {
      if (xmlData.length > i + 5 && xmlData[i + 1] === "-" && xmlData[i + 2] === "-") {
        for (i += 3; i < xmlData.length; i++) {
          if (xmlData[i] === "-" && xmlData[i + 1] === "-" && xmlData[i + 2] === ">") {
            i += 2;
            break;
          }
        }
      } else if (xmlData.length > i + 8 && xmlData[i + 1] === "D" && xmlData[i + 2] === "O" && xmlData[i + 3] === "C" && xmlData[i + 4] === "T" && xmlData[i + 5] === "Y" && xmlData[i + 6] === "P" && xmlData[i + 7] === "E") {
        let angleBracketsCount = 1;
        for (i += 8; i < xmlData.length; i++) {
          if (xmlData[i] === "<") {
            angleBracketsCount++;
          } else if (xmlData[i] === ">") {
            angleBracketsCount--;
            if (angleBracketsCount === 0) {
              break;
            }
          }
        }
      } else if (xmlData.length > i + 9 && xmlData[i + 1] === "[" && xmlData[i + 2] === "C" && xmlData[i + 3] === "D" && xmlData[i + 4] === "A" && xmlData[i + 5] === "T" && xmlData[i + 6] === "A" && xmlData[i + 7] === "[") {
        for (i += 8; i < xmlData.length; i++) {
          if (xmlData[i] === "]" && xmlData[i + 1] === "]" && xmlData[i + 2] === ">") {
            i += 2;
            break;
          }
        }
      }
      return i;
    }
    var doubleQuote = '"';
    var singleQuote = "'";
    function readAttributeStr(xmlData, i) {
      let attrStr = "";
      let startChar = "";
      let tagClosed = false;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
          if (startChar === "") {
            startChar = xmlData[i];
          } else if (startChar !== xmlData[i]) {
          } else {
            startChar = "";
          }
        } else if (xmlData[i] === ">") {
          if (startChar === "") {
            tagClosed = true;
            break;
          }
        }
        attrStr += xmlData[i];
      }
      if (startChar !== "") {
        return false;
      }
      return {
        value: attrStr,
        index: i,
        tagClosed
      };
    }
    var validAttrStrRegxp = new RegExp(`(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['"])(([\\s\\S])*?)\\5)?`, "g");
    function validateAttributeString(attrStr, options) {
      const matches = util.getAllMatches(attrStr, validAttrStrRegxp);
      const attrNames = {};
      for (let i = 0; i < matches.length; i++) {
        if (matches[i][1].length === 0) {
          return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' has no space in starting.", getPositionFromMatch(matches[i]));
        } else if (matches[i][3] !== void 0 && matches[i][4] === void 0) {
          return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' is without value.", getPositionFromMatch(matches[i]));
        } else if (matches[i][3] === void 0 && !options.allowBooleanAttributes) {
          return getErrorObject("InvalidAttr", "boolean attribute '" + matches[i][2] + "' is not allowed.", getPositionFromMatch(matches[i]));
        }
        const attrName = matches[i][2];
        if (!validateAttrName(attrName)) {
          return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is an invalid name.", getPositionFromMatch(matches[i]));
        }
        if (!attrNames.hasOwnProperty(attrName)) {
          attrNames[attrName] = 1;
        } else {
          return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is repeated.", getPositionFromMatch(matches[i]));
        }
      }
      return true;
    }
    function validateNumberAmpersand(xmlData, i) {
      let re = /\d/;
      if (xmlData[i] === "x") {
        i++;
        re = /[\da-fA-F]/;
      }
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === ";")
          return i;
        if (!xmlData[i].match(re))
          break;
      }
      return -1;
    }
    function validateAmpersand(xmlData, i) {
      i++;
      if (xmlData[i] === ";")
        return -1;
      if (xmlData[i] === "#") {
        i++;
        return validateNumberAmpersand(xmlData, i);
      }
      let count = 0;
      for (; i < xmlData.length; i++, count++) {
        if (xmlData[i].match(/\w/) && count < 20)
          continue;
        if (xmlData[i] === ";")
          break;
        return -1;
      }
      return i;
    }
    function getErrorObject(code, message, lineNumber) {
      return {
        err: {
          code,
          msg: message,
          line: lineNumber.line || lineNumber,
          col: lineNumber.col
        }
      };
    }
    function validateAttrName(attrName) {
      return util.isName(attrName);
    }
    function validateTagName(tagname) {
      return util.isName(tagname);
    }
    function getLineNumberForPosition(xmlData, index) {
      const lines = xmlData.substring(0, index).split(/\r?\n/);
      return {
        line: lines.length,
        // column number is last line's length + 1, because column numbering starts at 1:
        col: lines[lines.length - 1].length + 1
      };
    }
    function getPositionFromMatch(match) {
      return match.startIndex + match[1].length;
    }
  }
});

// node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js
var require_OptionsBuilder = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js"(exports2) {
    var { DANGEROUS_PROPERTY_NAMES, criticalProperties } = require_util();
    var defaultOnDangerousProperty = (name) => {
      if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
        return "__" + name;
      }
      return name;
    };
    var defaultOptions = {
      preserveOrder: false,
      attributeNamePrefix: "@_",
      attributesGroupName: false,
      textNodeName: "#text",
      ignoreAttributes: true,
      removeNSPrefix: false,
      // remove NS from tag name or attribute name if true
      allowBooleanAttributes: false,
      //a tag can have attributes without any value
      //ignoreRootElement : false,
      parseTagValue: true,
      parseAttributeValue: false,
      trimValues: true,
      //Trim string values of tag and attributes
      cdataPropName: false,
      numberParseOptions: {
        hex: true,
        leadingZeros: true,
        eNotation: true
      },
      tagValueProcessor: function(tagName, val) {
        return val;
      },
      attributeValueProcessor: function(attrName, val) {
        return val;
      },
      stopNodes: [],
      //nested tags will not be parsed even for errors
      alwaysCreateTextNode: false,
      isArray: () => false,
      commentPropName: false,
      unpairedTags: [],
      processEntities: true,
      htmlEntities: false,
      ignoreDeclaration: false,
      ignorePiTags: false,
      transformTagName: false,
      transformAttributeName: false,
      updateTag: function(tagName, jPath, attrs2) {
        return tagName;
      },
      // skipEmptyListItem: false
      captureMetaData: false,
      maxNestedTags: 100,
      strictReservedNames: true,
      onDangerousProperty: defaultOnDangerousProperty
    };
    function validatePropertyName(propertyName, optionName) {
      if (typeof propertyName !== "string") {
        return;
      }
      const normalized = propertyName.toLowerCase();
      if (DANGEROUS_PROPERTY_NAMES.some((dangerous) => normalized === dangerous.toLowerCase())) {
        throw new Error(
          `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      }
      if (criticalProperties.some((dangerous) => normalized === dangerous.toLowerCase())) {
        throw new Error(
          `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      }
    }
    function normalizeProcessEntities(value) {
      if (typeof value === "boolean") {
        return {
          enabled: value,
          // true or false
          maxEntitySize: 1e4,
          maxExpansionDepth: 10,
          maxTotalExpansions: 1e3,
          maxExpandedLength: 1e5,
          allowedTags: null,
          tagFilter: null
        };
      }
      if (typeof value === "object" && value !== null) {
        return {
          enabled: value.enabled !== false,
          maxEntitySize: Math.max(1, value.maxEntitySize ?? 1e4),
          maxExpansionDepth: Math.max(1, value.maxExpansionDepth ?? 1e4),
          maxTotalExpansions: Math.max(1, value.maxTotalExpansions ?? Infinity),
          maxExpandedLength: Math.max(1, value.maxExpandedLength ?? 1e5),
          maxEntityCount: Math.max(1, value.maxEntityCount ?? 1e3),
          allowedTags: value.allowedTags ?? null,
          tagFilter: value.tagFilter ?? null
        };
      }
      return normalizeProcessEntities(true);
    }
    var buildOptions = function(options) {
      const built = Object.assign({}, defaultOptions, options);
      const propertyNameOptions = [
        { value: built.attributeNamePrefix, name: "attributeNamePrefix" },
        { value: built.attributesGroupName, name: "attributesGroupName" },
        { value: built.textNodeName, name: "textNodeName" },
        { value: built.cdataPropName, name: "cdataPropName" },
        { value: built.commentPropName, name: "commentPropName" }
      ];
      for (const { value, name } of propertyNameOptions) {
        if (value) {
          validatePropertyName(value, name);
        }
      }
      if (built.onDangerousProperty === null) {
        built.onDangerousProperty = defaultOnDangerousProperty;
      }
      built.processEntities = normalizeProcessEntities(built.processEntities);
      return built;
    };
    exports2.buildOptions = buildOptions;
    exports2.defaultOptions = defaultOptions;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/xmlNode.js
var require_xmlNode = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/xmlNode.js"(exports2, module2) {
    "use strict";
    var XmlNode = class {
      constructor(tagname) {
        this.tagname = tagname;
        this.child = [];
        this[":@"] = {};
      }
      add(key, val) {
        if (key === "__proto__") key = "#__proto__";
        this.child.push({ [key]: val });
      }
      addChild(node) {
        if (node.tagname === "__proto__") node.tagname = "#__proto__";
        if (node[":@"] && Object.keys(node[":@"]).length > 0) {
          this.child.push({ [node.tagname]: node.child, [":@"]: node[":@"] });
        } else {
          this.child.push({ [node.tagname]: node.child });
        }
      }
    };
    module2.exports = XmlNode;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js
var require_DocTypeReader = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js"(exports2, module2) {
    var util = require_util();
    var DocTypeReader = class {
      constructor(options) {
        this.suppressValidationErr = !options;
        this.options = options || {};
      }
      readDocType(xmlData, i) {
        const entities = /* @__PURE__ */ Object.create(null);
        let entityCount = 0;
        if (xmlData[i + 3] === "O" && xmlData[i + 4] === "C" && xmlData[i + 5] === "T" && xmlData[i + 6] === "Y" && xmlData[i + 7] === "P" && xmlData[i + 8] === "E") {
          i = i + 9;
          let angleBracketsCount = 1;
          let hasBody = false, comment = false;
          let exp = "";
          for (; i < xmlData.length; i++) {
            if (xmlData[i] === "<" && !comment) {
              if (hasBody && hasSeq(xmlData, "!ENTITY", i)) {
                i += 7;
                let entityName, val;
                [entityName, val, i] = this.readEntityExp(xmlData, i + 1, this.suppressValidationErr);
                if (val.indexOf("&") === -1) {
                  if (this.options.enabled !== false && this.options.maxEntityCount != null && entityCount >= this.options.maxEntityCount) {
                    throw new Error(
                      `Entity count (${entityCount + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`
                    );
                  }
                  const escaped = entityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  entities[entityName] = {
                    regx: RegExp(`&${escaped};`, "g"),
                    val
                  };
                  entityCount++;
                }
              } else if (hasBody && hasSeq(xmlData, "!ELEMENT", i)) {
                i += 8;
                const { index } = this.readElementExp(xmlData, i + 1);
                i = index;
              } else if (hasBody && hasSeq(xmlData, "!ATTLIST", i)) {
                i += 8;
              } else if (hasBody && hasSeq(xmlData, "!NOTATION", i)) {
                i += 9;
                const { index } = this.readNotationExp(xmlData, i + 1, this.suppressValidationErr);
                i = index;
              } else if (hasSeq(xmlData, "!--", i)) {
                comment = true;
              } else {
                throw new Error(`Invalid DOCTYPE`);
              }
              angleBracketsCount++;
              exp = "";
            } else if (xmlData[i] === ">") {
              if (comment) {
                if (xmlData[i - 1] === "-" && xmlData[i - 2] === "-") {
                  comment = false;
                  angleBracketsCount--;
                }
              } else {
                angleBracketsCount--;
              }
              if (angleBracketsCount === 0) {
                break;
              }
            } else if (xmlData[i] === "[") {
              hasBody = true;
            } else {
              exp += xmlData[i];
            }
          }
          if (angleBracketsCount !== 0) {
            throw new Error(`Unclosed DOCTYPE`);
          }
        } else {
          throw new Error(`Invalid Tag instead of DOCTYPE`);
        }
        return { entities, i };
      }
      readEntityExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let entityName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i]) && xmlData[i] !== '"' && xmlData[i] !== "'") {
          entityName += xmlData[i];
          i++;
        }
        validateEntityName(entityName);
        i = skipWhitespace(xmlData, i);
        if (!this.suppressValidationErr) {
          if (xmlData.substring(i, i + 6).toUpperCase() === "SYSTEM") {
            throw new Error("External entities are not supported");
          } else if (xmlData[i] === "%") {
            throw new Error("Parameter entities are not supported");
          }
        }
        let entityValue = "";
        [i, entityValue] = this.readIdentifierVal(xmlData, i, "entity");
        if (this.options.enabled !== false && this.options.maxEntitySize != null && entityValue.length > this.options.maxEntitySize) {
          throw new Error(
            `Entity "${entityName}" size (${entityValue.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`
          );
        }
        i--;
        return [entityName, entityValue, i];
      }
      readNotationExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let notationName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          notationName += xmlData[i];
          i++;
        }
        !this.suppressValidationErr && validateEntityName(notationName);
        i = skipWhitespace(xmlData, i);
        const identifierType = xmlData.substring(i, i + 6).toUpperCase();
        if (!this.suppressValidationErr && identifierType !== "SYSTEM" && identifierType !== "PUBLIC") {
          throw new Error(`Expected SYSTEM or PUBLIC, found "${identifierType}"`);
        }
        i += identifierType.length;
        i = skipWhitespace(xmlData, i);
        let publicIdentifier = null;
        let systemIdentifier = null;
        if (identifierType === "PUBLIC") {
          [i, publicIdentifier] = this.readIdentifierVal(xmlData, i, "publicIdentifier");
          i = skipWhitespace(xmlData, i);
          if (xmlData[i] === '"' || xmlData[i] === "'") {
            [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
          }
        } else if (identifierType === "SYSTEM") {
          [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
          if (!this.suppressValidationErr && !systemIdentifier) {
            throw new Error("Missing mandatory system identifier for SYSTEM notation");
          }
        }
        return { notationName, publicIdentifier, systemIdentifier, index: --i };
      }
      readIdentifierVal(xmlData, i, type) {
        let identifierVal = "";
        const startChar = xmlData[i];
        if (startChar !== '"' && startChar !== "'") {
          throw new Error(`Expected quoted string, found "${startChar}"`);
        }
        i++;
        while (i < xmlData.length && xmlData[i] !== startChar) {
          identifierVal += xmlData[i];
          i++;
        }
        if (xmlData[i] !== startChar) {
          throw new Error(`Unterminated ${type} value`);
        }
        i++;
        return [i, identifierVal];
      }
      readElementExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let elementName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          elementName += xmlData[i];
          i++;
        }
        if (!this.suppressValidationErr && !util.isName(elementName)) {
          throw new Error(`Invalid element name: "${elementName}"`);
        }
        i = skipWhitespace(xmlData, i);
        let contentModel = "";
        if (xmlData[i] === "E" && hasSeq(xmlData, "MPTY", i)) {
          i += 4;
        } else if (xmlData[i] === "A" && hasSeq(xmlData, "NY", i)) {
          i += 2;
        } else if (xmlData[i] === "(") {
          i++;
          while (i < xmlData.length && xmlData[i] !== ")") {
            contentModel += xmlData[i];
            i++;
          }
          if (xmlData[i] !== ")") {
            throw new Error("Unterminated content model");
          }
        } else if (!this.suppressValidationErr) {
          throw new Error(`Invalid Element Expression, found "${xmlData[i]}"`);
        }
        return {
          elementName,
          contentModel: contentModel.trim(),
          index: i
        };
      }
      readAttlistExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let elementName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          elementName += xmlData[i];
          i++;
        }
        validateEntityName(elementName);
        i = skipWhitespace(xmlData, i);
        let attributeName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          attributeName += xmlData[i];
          i++;
        }
        if (!validateEntityName(attributeName)) {
          throw new Error(`Invalid attribute name: "${attributeName}"`);
        }
        i = skipWhitespace(xmlData, i);
        let attributeType = "";
        if (xmlData.substring(i, i + 8).toUpperCase() === "NOTATION") {
          attributeType = "NOTATION";
          i += 8;
          i = skipWhitespace(xmlData, i);
          if (xmlData[i] !== "(") {
            throw new Error(`Expected '(', found "${xmlData[i]}"`);
          }
          i++;
          let allowedNotations = [];
          while (i < xmlData.length && xmlData[i] !== ")") {
            let notation = "";
            while (i < xmlData.length && xmlData[i] !== "|" && xmlData[i] !== ")") {
              notation += xmlData[i];
              i++;
            }
            notation = notation.trim();
            if (!validateEntityName(notation)) {
              throw new Error(`Invalid notation name: "${notation}"`);
            }
            allowedNotations.push(notation);
            if (xmlData[i] === "|") {
              i++;
              i = skipWhitespace(xmlData, i);
            }
          }
          if (xmlData[i] !== ")") {
            throw new Error("Unterminated list of notations");
          }
          i++;
          attributeType += " (" + allowedNotations.join("|") + ")";
        } else {
          while (i < xmlData.length && !/\s/.test(xmlData[i])) {
            attributeType += xmlData[i];
            i++;
          }
          const validTypes = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
          if (!this.suppressValidationErr && !validTypes.includes(attributeType.toUpperCase())) {
            throw new Error(`Invalid attribute type: "${attributeType}"`);
          }
        }
        i = skipWhitespace(xmlData, i);
        let defaultValue = "";
        if (xmlData.substring(i, i + 8).toUpperCase() === "#REQUIRED") {
          defaultValue = "#REQUIRED";
          i += 8;
        } else if (xmlData.substring(i, i + 7).toUpperCase() === "#IMPLIED") {
          defaultValue = "#IMPLIED";
          i += 7;
        } else {
          [i, defaultValue] = this.readIdentifierVal(xmlData, i, "ATTLIST");
        }
        return {
          elementName,
          attributeName,
          attributeType,
          defaultValue,
          index: i
        };
      }
    };
    var skipWhitespace = (data, index) => {
      while (index < data.length && /\s/.test(data[index])) {
        index++;
      }
      return index;
    };
    function hasSeq(data, seq, i) {
      for (let j = 0; j < seq.length; j++) {
        if (seq[j] !== data[i + j + 1]) return false;
      }
      return true;
    }
    function validateEntityName(name) {
      if (util.isName(name))
        return name;
      else
        throw new Error(`Invalid entity name ${name}`);
    }
    module2.exports = DocTypeReader;
  }
});

// node_modules/strnum/strnum.js
var require_strnum = __commonJS({
  "node_modules/strnum/strnum.js"(exports2, module2) {
    var hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
    var numRegex = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;
    var consider = {
      hex: true,
      // oct: false,
      leadingZeros: true,
      decimalPoint: ".",
      eNotation: true
      //skipLike: /regex/
    };
    function toNumber(str, options = {}) {
      options = Object.assign({}, consider, options);
      if (!str || typeof str !== "string") return str;
      let trimmedStr = str.trim();
      if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str;
      else if (str === "0") return 0;
      else if (options.hex && hexRegex.test(trimmedStr)) {
        return parse_int(trimmedStr, 16);
      } else if (trimmedStr.search(/[eE]/) !== -1) {
        const notation = trimmedStr.match(/^([-\+])?(0*)([0-9]*(\.[0-9]*)?[eE][-\+]?[0-9]+)$/);
        if (notation) {
          if (options.leadingZeros) {
            trimmedStr = (notation[1] || "") + notation[3];
          } else {
            if (notation[2] === "0" && notation[3][0] === ".") {
            } else {
              return str;
            }
          }
          return options.eNotation ? Number(trimmedStr) : str;
        } else {
          return str;
        }
      } else {
        const match = numRegex.exec(trimmedStr);
        if (match) {
          const sign = match[1];
          const leadingZeros = match[2];
          let numTrimmedByZeros = trimZeros(match[3]);
          if (!options.leadingZeros && leadingZeros.length > 0 && sign && trimmedStr[2] !== ".") return str;
          else if (!options.leadingZeros && leadingZeros.length > 0 && !sign && trimmedStr[1] !== ".") return str;
          else if (options.leadingZeros && leadingZeros === str) return 0;
          else {
            const num = Number(trimmedStr);
            const numStr = "" + num;
            if (numStr.search(/[eE]/) !== -1) {
              if (options.eNotation) return num;
              else return str;
            } else if (trimmedStr.indexOf(".") !== -1) {
              if (numStr === "0" && numTrimmedByZeros === "") return num;
              else if (numStr === numTrimmedByZeros) return num;
              else if (sign && numStr === "-" + numTrimmedByZeros) return num;
              else return str;
            }
            if (leadingZeros) {
              return numTrimmedByZeros === numStr || sign + numTrimmedByZeros === numStr ? num : str;
            } else {
              return trimmedStr === numStr || trimmedStr === sign + numStr ? num : str;
            }
          }
        } else {
          return str;
        }
      }
    }
    function trimZeros(numStr) {
      if (numStr && numStr.indexOf(".") !== -1) {
        numStr = numStr.replace(/0+$/, "");
        if (numStr === ".") numStr = "0";
        else if (numStr[0] === ".") numStr = "0" + numStr;
        else if (numStr[numStr.length - 1] === ".") numStr = numStr.substr(0, numStr.length - 1);
        return numStr;
      }
      return numStr;
    }
    function parse_int(numStr, base2) {
      if (parseInt) return parseInt(numStr, base2);
      else if (Number.parseInt) return Number.parseInt(numStr, base2);
      else if (window && window.parseInt) return window.parseInt(numStr, base2);
      else throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
    }
    module2.exports = toNumber;
  }
});

// node_modules/fast-xml-parser/src/ignoreAttributes.js
var require_ignoreAttributes = __commonJS({
  "node_modules/fast-xml-parser/src/ignoreAttributes.js"(exports2, module2) {
    function getIgnoreAttributesFn(ignoreAttributes) {
      if (typeof ignoreAttributes === "function") {
        return ignoreAttributes;
      }
      if (Array.isArray(ignoreAttributes)) {
        return (attrName) => {
          for (const pattern of ignoreAttributes) {
            if (typeof pattern === "string" && attrName === pattern) {
              return true;
            }
            if (pattern instanceof RegExp && pattern.test(attrName)) {
              return true;
            }
          }
        };
      }
      return () => false;
    }
    module2.exports = getIgnoreAttributesFn;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js
var require_OrderedObjParser = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js"(exports2, module2) {
    "use strict";
    var util = require_util();
    var xmlNode = require_xmlNode();
    var DocTypeReader = require_DocTypeReader();
    var toNumber = require_strnum();
    var getIgnoreAttributesFn = require_ignoreAttributes();
    var OrderedObjParser = class {
      constructor(options) {
        this.options = options;
        this.currentNode = null;
        this.tagsNodeStack = [];
        this.docTypeEntities = {};
        this.lastEntities = {
          "apos": { regex: /&(apos|#39|#x27);/g, val: "'" },
          "gt": { regex: /&(gt|#62|#x3E);/g, val: ">" },
          "lt": { regex: /&(lt|#60|#x3C);/g, val: "<" },
          "quot": { regex: /&(quot|#34|#x22);/g, val: '"' }
        };
        this.ampEntity = { regex: /&(amp|#38|#x26);/g, val: "&" };
        this.htmlEntities = {
          "space": { regex: /&(nbsp|#160);/g, val: " " },
          // "lt" : { regex: /&(lt|#60);/g, val: "<" },
          // "gt" : { regex: /&(gt|#62);/g, val: ">" },
          // "amp" : { regex: /&(amp|#38);/g, val: "&" },
          // "quot" : { regex: /&(quot|#34);/g, val: "\"" },
          // "apos" : { regex: /&(apos|#39);/g, val: "'" },
          "cent": { regex: /&(cent|#162);/g, val: "\xA2" },
          "pound": { regex: /&(pound|#163);/g, val: "\xA3" },
          "yen": { regex: /&(yen|#165);/g, val: "\xA5" },
          "euro": { regex: /&(euro|#8364);/g, val: "\u20AC" },
          "copyright": { regex: /&(copy|#169);/g, val: "\xA9" },
          "reg": { regex: /&(reg|#174);/g, val: "\xAE" },
          "inr": { regex: /&(inr|#8377);/g, val: "\u20B9" },
          "num_dec": { regex: /&#([0-9]{1,7});/g, val: (_, str) => fromCodePoint(str, 10, "&#") },
          "num_hex": { regex: /&#x([0-9a-fA-F]{1,6});/g, val: (_, str) => fromCodePoint(str, 16, "&#x") }
        };
        this.addExternalEntities = addExternalEntities;
        this.parseXml = parseXml2;
        this.parseTextData = parseTextData;
        this.resolveNameSpace = resolveNameSpace;
        this.buildAttributesMap = buildAttributesMap;
        this.isItStopNode = isItStopNode;
        this.replaceEntitiesValue = replaceEntitiesValue;
        this.readStopNodeData = readStopNodeData;
        this.saveTextToParentTag = saveTextToParentTag;
        this.addChild = addChild;
        this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
        this.entityExpansionCount = 0;
        this.currentExpandedLength = 0;
        if (this.options.stopNodes && this.options.stopNodes.length > 0) {
          this.stopNodesExact = /* @__PURE__ */ new Set();
          this.stopNodesWildcard = /* @__PURE__ */ new Set();
          for (let i = 0; i < this.options.stopNodes.length; i++) {
            const stopNodeExp = this.options.stopNodes[i];
            if (typeof stopNodeExp !== "string") continue;
            if (stopNodeExp.startsWith("*.")) {
              this.stopNodesWildcard.add(stopNodeExp.substring(2));
            } else {
              this.stopNodesExact.add(stopNodeExp);
            }
          }
        }
      }
    };
    function addExternalEntities(externalEntities) {
      const entKeys = Object.keys(externalEntities);
      for (let i = 0; i < entKeys.length; i++) {
        const ent = entKeys[i];
        const escaped = ent.replace(/[.\-+*:]/g, "\\.");
        this.lastEntities[ent] = {
          regex: new RegExp("&" + escaped + ";", "g"),
          val: externalEntities[ent]
        };
      }
    }
    function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
      if (val !== void 0) {
        if (this.options.trimValues && !dontTrim) {
          val = val.trim();
        }
        if (val.length > 0) {
          if (!escapeEntities) val = this.replaceEntitiesValue(val, tagName, jPath);
          const newval = this.options.tagValueProcessor(tagName, val, jPath, hasAttributes, isLeafNode);
          if (newval === null || newval === void 0) {
            return val;
          } else if (typeof newval !== typeof val || newval !== val) {
            return newval;
          } else if (this.options.trimValues) {
            return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
          } else {
            const trimmedVal = val.trim();
            if (trimmedVal === val) {
              return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
            } else {
              return val;
            }
          }
        }
      }
    }
    function resolveNameSpace(tagname) {
      if (this.options.removeNSPrefix) {
        const tags = tagname.split(":");
        const prefix = tagname.charAt(0) === "/" ? "/" : "";
        if (tags[0] === "xmlns") {
          return "";
        }
        if (tags.length === 2) {
          tagname = prefix + tags[1];
        }
      }
      return tagname;
    }
    var attrsRegx = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
    function buildAttributesMap(attrStr, jPath, tagName) {
      if (this.options.ignoreAttributes !== true && typeof attrStr === "string") {
        const matches = util.getAllMatches(attrStr, attrsRegx);
        const len = matches.length;
        const attrs2 = {};
        for (let i = 0; i < len; i++) {
          const attrName = this.resolveNameSpace(matches[i][1]);
          if (this.ignoreAttributesFn(attrName, jPath)) {
            continue;
          }
          let oldVal = matches[i][4];
          let aName = this.options.attributeNamePrefix + attrName;
          if (attrName.length) {
            if (this.options.transformAttributeName) {
              aName = this.options.transformAttributeName(aName);
            }
            aName = sanitizeName(aName, this.options);
            if (oldVal !== void 0) {
              if (this.options.trimValues) {
                oldVal = oldVal.trim();
              }
              oldVal = this.replaceEntitiesValue(oldVal, tagName, jPath);
              const newVal = this.options.attributeValueProcessor(attrName, oldVal, jPath);
              if (newVal === null || newVal === void 0) {
                attrs2[aName] = oldVal;
              } else if (typeof newVal !== typeof oldVal || newVal !== oldVal) {
                attrs2[aName] = newVal;
              } else {
                attrs2[aName] = parseValue(
                  oldVal,
                  this.options.parseAttributeValue,
                  this.options.numberParseOptions
                );
              }
            } else if (this.options.allowBooleanAttributes) {
              attrs2[aName] = true;
            }
          }
        }
        if (!Object.keys(attrs2).length) {
          return;
        }
        if (this.options.attributesGroupName) {
          const attrCollection = {};
          attrCollection[this.options.attributesGroupName] = attrs2;
          return attrCollection;
        }
        return attrs2;
      }
    }
    var parseXml2 = function(xmlData) {
      xmlData = xmlData.replace(/\r\n?/g, "\n");
      const xmlObj = new xmlNode("!xml");
      let currentNode = xmlObj;
      let textData = "";
      let jPath = "";
      this.entityExpansionCount = 0;
      this.currentExpandedLength = 0;
      const docTypeReader = new DocTypeReader(this.options.processEntities);
      for (let i = 0; i < xmlData.length; i++) {
        const ch = xmlData[i];
        if (ch === "<") {
          if (xmlData[i + 1] === "/") {
            const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.");
            let tagName = xmlData.substring(i + 2, closeIndex).trim();
            if (this.options.removeNSPrefix) {
              const colonIndex = tagName.indexOf(":");
              if (colonIndex !== -1) {
                tagName = tagName.substr(colonIndex + 1);
              }
            }
            if (this.options.transformTagName) {
              tagName = this.options.transformTagName(tagName);
            }
            if (currentNode) {
              textData = this.saveTextToParentTag(textData, currentNode, jPath);
            }
            const lastTagName = jPath.substring(jPath.lastIndexOf(".") + 1);
            if (tagName && this.options.unpairedTags.indexOf(tagName) !== -1) {
              throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
            }
            let propIndex = 0;
            if (lastTagName && this.options.unpairedTags.indexOf(lastTagName) !== -1) {
              propIndex = jPath.lastIndexOf(".", jPath.lastIndexOf(".") - 1);
              this.tagsNodeStack.pop();
            } else {
              propIndex = jPath.lastIndexOf(".");
            }
            jPath = jPath.substring(0, propIndex);
            currentNode = this.tagsNodeStack.pop();
            textData = "";
            i = closeIndex;
          } else if (xmlData[i + 1] === "?") {
            let tagData = readTagExp(xmlData, i, false, "?>");
            if (!tagData) throw new Error("Pi Tag is not closed.");
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            if (this.options.ignoreDeclaration && tagData.tagName === "?xml" || this.options.ignorePiTags) {
            } else {
              const childNode = new xmlNode(tagData.tagName);
              childNode.add(this.options.textNodeName, "");
              if (tagData.tagName !== tagData.tagExp && tagData.attrExpPresent) {
                childNode[":@"] = this.buildAttributesMap(tagData.tagExp, jPath, tagData.tagName);
              }
              this.addChild(currentNode, childNode, jPath, i);
            }
            i = tagData.closeIndex + 1;
          } else if (xmlData.substr(i + 1, 3) === "!--") {
            const endIndex = findClosingIndex(xmlData, "-->", i + 4, "Comment is not closed.");
            if (this.options.commentPropName) {
              const comment = xmlData.substring(i + 4, endIndex - 2);
              textData = this.saveTextToParentTag(textData, currentNode, jPath);
              currentNode.add(this.options.commentPropName, [{ [this.options.textNodeName]: comment }]);
            }
            i = endIndex;
          } else if (xmlData.substr(i + 1, 2) === "!D") {
            const result = docTypeReader.readDocType(xmlData, i);
            this.docTypeEntities = result.entities;
            i = result.i;
          } else if (xmlData.substr(i + 1, 2) === "![") {
            const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
            const tagExp = xmlData.substring(i + 9, closeIndex);
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            let val = this.parseTextData(tagExp, currentNode.tagname, jPath, true, false, true, true);
            if (val == void 0) val = "";
            if (this.options.cdataPropName) {
              currentNode.add(this.options.cdataPropName, [{ [this.options.textNodeName]: tagExp }]);
            } else {
              currentNode.add(this.options.textNodeName, val);
            }
            i = closeIndex + 2;
          } else {
            let result = readTagExp(xmlData, i, this.options.removeNSPrefix);
            let tagName = result.tagName;
            const rawTagName = result.rawTagName;
            let tagExp = result.tagExp;
            let attrExpPresent = result.attrExpPresent;
            let closeIndex = result.closeIndex;
            if (this.options.transformTagName) {
              const newTagName = this.options.transformTagName(tagName);
              if (tagExp === tagName) {
                tagExp = newTagName;
              }
              tagName = newTagName;
            }
            if (this.options.strictReservedNames && (tagName === this.options.commentPropName || tagName === this.options.cdataPropName || tagName === this.options.textNodeName || tagName === this.options.attributesGroupName)) {
              throw new Error(`Invalid tag name: ${tagName}`);
            }
            if (currentNode && textData) {
              if (currentNode.tagname !== "!xml") {
                textData = this.saveTextToParentTag(textData, currentNode, jPath, false);
              }
            }
            const lastTag = currentNode;
            if (lastTag && this.options.unpairedTags.indexOf(lastTag.tagname) !== -1) {
              currentNode = this.tagsNodeStack.pop();
              jPath = jPath.substring(0, jPath.lastIndexOf("."));
            }
            if (tagName !== xmlObj.tagname) {
              jPath += jPath ? "." + tagName : tagName;
            }
            const startIndex = i;
            if (this.isItStopNode(this.stopNodesExact, this.stopNodesWildcard, jPath, tagName)) {
              let tagContent = "";
              if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
                if (tagName[tagName.length - 1] === "/") {
                  tagName = tagName.substr(0, tagName.length - 1);
                  jPath = jPath.substr(0, jPath.length - 1);
                  tagExp = tagName;
                } else {
                  tagExp = tagExp.substr(0, tagExp.length - 1);
                }
                i = result.closeIndex;
              } else if (this.options.unpairedTags.indexOf(tagName) !== -1) {
                i = result.closeIndex;
              } else {
                const result2 = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
                if (!result2) throw new Error(`Unexpected end of ${rawTagName}`);
                i = result2.i;
                tagContent = result2.tagContent;
              }
              const childNode = new xmlNode(tagName);
              if (tagName !== tagExp && attrExpPresent) {
                childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
              }
              if (tagContent) {
                tagContent = this.parseTextData(tagContent, tagName, jPath, true, attrExpPresent, true, true);
              }
              jPath = jPath.substr(0, jPath.lastIndexOf("."));
              childNode.add(this.options.textNodeName, tagContent);
              this.addChild(currentNode, childNode, jPath, startIndex);
            } else {
              if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
                if (tagName[tagName.length - 1] === "/") {
                  tagName = tagName.substr(0, tagName.length - 1);
                  jPath = jPath.substr(0, jPath.length - 1);
                  tagExp = tagName;
                } else {
                  tagExp = tagExp.substr(0, tagExp.length - 1);
                }
                if (this.options.transformTagName) {
                  const newTagName = this.options.transformTagName(tagName);
                  if (tagExp === tagName) {
                    tagExp = newTagName;
                  }
                  tagName = newTagName;
                }
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath, startIndex);
                jPath = jPath.substr(0, jPath.lastIndexOf("."));
              } else if (this.options.unpairedTags.indexOf(tagName) !== -1) {
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath);
                }
                this.addChild(currentNode, childNode, jPath, startIndex);
                jPath = jPath.substr(0, jPath.lastIndexOf("."));
                i = result.closeIndex;
                continue;
              } else {
                const childNode = new xmlNode(tagName);
                if (this.tagsNodeStack.length > this.options.maxNestedTags) {
                  throw new Error("Maximum nested tags exceeded");
                }
                this.tagsNodeStack.push(currentNode);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath);
                currentNode = childNode;
              }
              textData = "";
              i = closeIndex;
            }
          }
        } else {
          textData += xmlData[i];
        }
      }
      return xmlObj.child;
    };
    function addChild(currentNode, childNode, jPath, startIndex) {
      if (!this.options.captureMetaData) startIndex = void 0;
      const result = this.options.updateTag(childNode.tagname, jPath, childNode[":@"]);
      if (result === false) {
      } else if (typeof result === "string") {
        childNode.tagname = result;
        currentNode.addChild(childNode, startIndex);
      } else {
        currentNode.addChild(childNode, startIndex);
      }
    }
    var replaceEntitiesValue = function(val, tagName, jPath) {
      if (val.indexOf("&") === -1) {
        return val;
      }
      const entityConfig = this.options.processEntities;
      if (!entityConfig.enabled) {
        return val;
      }
      if (entityConfig.allowedTags) {
        if (!entityConfig.allowedTags.includes(tagName)) {
          return val;
        }
      }
      if (entityConfig.tagFilter) {
        if (!entityConfig.tagFilter(tagName, jPath)) {
          return val;
        }
      }
      for (let entityName in this.docTypeEntities) {
        const entity = this.docTypeEntities[entityName];
        const matches = val.match(entity.regx);
        if (matches) {
          this.entityExpansionCount += matches.length;
          if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
            throw new Error(
              `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
            );
          }
          const lengthBefore = val.length;
          val = val.replace(entity.regx, entity.val);
          if (entityConfig.maxExpandedLength) {
            this.currentExpandedLength += val.length - lengthBefore;
            if (this.currentExpandedLength > entityConfig.maxExpandedLength) {
              throw new Error(
                `Total expanded content size exceeded: ${this.currentExpandedLength} > ${entityConfig.maxExpandedLength}`
              );
            }
          }
        }
      }
      if (val.indexOf("&") === -1) return val;
      for (const entityName of Object.keys(this.lastEntities)) {
        const entity = this.lastEntities[entityName];
        const matches = val.match(entity.regex);
        if (matches) {
          this.entityExpansionCount += matches.length;
          if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
            throw new Error(
              `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
            );
          }
        }
        val = val.replace(entity.regex, entity.val);
      }
      if (val.indexOf("&") === -1) return val;
      if (this.options.htmlEntities) {
        for (const entityName of Object.keys(this.htmlEntities)) {
          const entity = this.htmlEntities[entityName];
          const matches = val.match(entity.regex);
          if (matches) {
            this.entityExpansionCount += matches.length;
            if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
              throw new Error(
                `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
              );
            }
          }
          val = val.replace(entity.regex, entity.val);
        }
      }
      val = val.replace(this.ampEntity.regex, this.ampEntity.val);
      return val;
    };
    function saveTextToParentTag(textData, parentNode, jPath, isLeafNode) {
      if (textData) {
        if (isLeafNode === void 0) isLeafNode = parentNode.child.length === 0;
        textData = this.parseTextData(
          textData,
          parentNode.tagname,
          jPath,
          false,
          parentNode[":@"] ? Object.keys(parentNode[":@"]).length !== 0 : false,
          isLeafNode
        );
        if (textData !== void 0 && textData !== "")
          parentNode.add(this.options.textNodeName, textData);
        textData = "";
      }
      return textData;
    }
    function isItStopNode(stopNodesExact, stopNodesWildcard, jPath, currentTagName) {
      if (stopNodesWildcard && stopNodesWildcard.has(currentTagName)) return true;
      if (stopNodesExact && stopNodesExact.has(jPath)) return true;
      return false;
    }
    function tagExpWithClosingIndex(xmlData, i, closingChar = ">") {
      let attrBoundary;
      let tagExp = "";
      for (let index = i; index < xmlData.length; index++) {
        let ch = xmlData[index];
        if (attrBoundary) {
          if (ch === attrBoundary) attrBoundary = "";
        } else if (ch === '"' || ch === "'") {
          attrBoundary = ch;
        } else if (ch === closingChar[0]) {
          if (closingChar[1]) {
            if (xmlData[index + 1] === closingChar[1]) {
              return {
                data: tagExp,
                index
              };
            }
          } else {
            return {
              data: tagExp,
              index
            };
          }
        } else if (ch === "	") {
          ch = " ";
        }
        tagExp += ch;
      }
    }
    function findClosingIndex(xmlData, str, i, errMsg) {
      const closingIndex = xmlData.indexOf(str, i);
      if (closingIndex === -1) {
        throw new Error(errMsg);
      } else {
        return closingIndex + str.length - 1;
      }
    }
    function readTagExp(xmlData, i, removeNSPrefix, closingChar = ">") {
      const result = tagExpWithClosingIndex(xmlData, i + 1, closingChar);
      if (!result) return;
      let tagExp = result.data;
      const closeIndex = result.index;
      const separatorIndex = tagExp.search(/\s/);
      let tagName = tagExp;
      let attrExpPresent = true;
      if (separatorIndex !== -1) {
        tagName = tagExp.substring(0, separatorIndex);
        tagExp = tagExp.substring(separatorIndex + 1).trimStart();
      }
      const rawTagName = tagName;
      if (removeNSPrefix) {
        const colonIndex = tagName.indexOf(":");
        if (colonIndex !== -1) {
          tagName = tagName.substr(colonIndex + 1);
          attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
        }
      }
      return {
        tagName,
        tagExp,
        closeIndex,
        attrExpPresent,
        rawTagName
      };
    }
    function readStopNodeData(xmlData, tagName, i) {
      const startIndex = i;
      let openTagCount = 1;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === "<") {
          if (xmlData[i + 1] === "/") {
            const closeIndex = findClosingIndex(xmlData, ">", i, `${tagName} is not closed`);
            let closeTagName = xmlData.substring(i + 2, closeIndex).trim();
            if (closeTagName === tagName) {
              openTagCount--;
              if (openTagCount === 0) {
                return {
                  tagContent: xmlData.substring(startIndex, i),
                  i: closeIndex
                };
              }
            }
            i = closeIndex;
          } else if (xmlData[i + 1] === "?") {
            const closeIndex = findClosingIndex(xmlData, "?>", i + 1, "StopNode is not closed.");
            i = closeIndex;
          } else if (xmlData.substr(i + 1, 3) === "!--") {
            const closeIndex = findClosingIndex(xmlData, "-->", i + 3, "StopNode is not closed.");
            i = closeIndex;
          } else if (xmlData.substr(i + 1, 2) === "![") {
            const closeIndex = findClosingIndex(xmlData, "]]>", i, "StopNode is not closed.") - 2;
            i = closeIndex;
          } else {
            const tagData = readTagExp(xmlData, i, ">");
            if (tagData) {
              const openTagName = tagData && tagData.tagName;
              if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length - 1] !== "/") {
                openTagCount++;
              }
              i = tagData.closeIndex;
            }
          }
        }
      }
    }
    function parseValue(val, shouldParse, options) {
      if (shouldParse && typeof val === "string") {
        const newval = val.trim();
        if (newval === "true") return true;
        else if (newval === "false") return false;
        else return toNumber(val, options);
      } else {
        if (util.isExist(val)) {
          return val;
        } else {
          return "";
        }
      }
    }
    function fromCodePoint(str, base2, prefix) {
      const codePoint = Number.parseInt(str, base2);
      if (codePoint >= 0 && codePoint <= 1114111) {
        return String.fromCodePoint(codePoint);
      } else {
        return prefix + str + ";";
      }
    }
    function sanitizeName(name, options) {
      if (util.criticalProperties.includes(name)) {
        throw new Error(`[SECURITY] Invalid name: "${name}" is a reserved JavaScript keyword that could cause prototype pollution`);
      } else if (util.DANGEROUS_PROPERTY_NAMES.includes(name)) {
        return options.onDangerousProperty(name);
      }
      return name;
    }
    module2.exports = OrderedObjParser;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/node2json.js
var require_node2json = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/node2json.js"(exports2) {
    "use strict";
    function prettify(node, options) {
      return compress(node, options);
    }
    function compress(arr, options, jPath) {
      let text;
      const compressedObj = {};
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const property = propName(tagObj);
        let newJpath = "";
        if (jPath === void 0) newJpath = property;
        else newJpath = jPath + "." + property;
        if (property === options.textNodeName) {
          if (text === void 0) text = tagObj[property];
          else text += "" + tagObj[property];
        } else if (property === void 0) {
          continue;
        } else if (tagObj[property]) {
          let val = compress(tagObj[property], options, newJpath);
          const isLeaf = isLeafTag(val, options);
          if (tagObj[":@"]) {
            assignAttributes(val, tagObj[":@"], newJpath, options);
          } else if (Object.keys(val).length === 1 && val[options.textNodeName] !== void 0 && !options.alwaysCreateTextNode) {
            val = val[options.textNodeName];
          } else if (Object.keys(val).length === 0) {
            if (options.alwaysCreateTextNode) val[options.textNodeName] = "";
            else val = "";
          }
          if (compressedObj[property] !== void 0 && compressedObj.hasOwnProperty(property)) {
            if (!Array.isArray(compressedObj[property])) {
              compressedObj[property] = [compressedObj[property]];
            }
            compressedObj[property].push(val);
          } else {
            if (options.isArray(property, newJpath, isLeaf)) {
              compressedObj[property] = [val];
            } else {
              compressedObj[property] = val;
            }
          }
        }
      }
      if (typeof text === "string") {
        if (text.length > 0) compressedObj[options.textNodeName] = text;
      } else if (text !== void 0) compressedObj[options.textNodeName] = text;
      return compressedObj;
    }
    function propName(obj) {
      const keys2 = Object.keys(obj);
      for (let i = 0; i < keys2.length; i++) {
        const key = keys2[i];
        if (key !== ":@") return key;
      }
    }
    function assignAttributes(obj, attrMap, jpath, options) {
      if (attrMap) {
        const keys2 = Object.keys(attrMap);
        const len = keys2.length;
        for (let i = 0; i < len; i++) {
          const atrrName = keys2[i];
          if (options.isArray(atrrName, jpath + "." + atrrName, true, true)) {
            obj[atrrName] = [attrMap[atrrName]];
          } else {
            obj[atrrName] = attrMap[atrrName];
          }
        }
      }
    }
    function isLeafTag(obj, options) {
      const { textNodeName } = options;
      const propCount = Object.keys(obj).length;
      if (propCount === 0) {
        return true;
      }
      if (propCount === 1 && (obj[textNodeName] || typeof obj[textNodeName] === "boolean" || obj[textNodeName] === 0)) {
        return true;
      }
      return false;
    }
    exports2.prettify = prettify;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/XMLParser.js
var require_XMLParser = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/XMLParser.js"(exports2, module2) {
    var { buildOptions } = require_OptionsBuilder();
    var OrderedObjParser = require_OrderedObjParser();
    var { prettify } = require_node2json();
    var validator = require_validator();
    var XMLParser2 = class {
      constructor(options) {
        this.externalEntities = {};
        this.options = buildOptions(options);
      }
      /**
       * Parse XML dats to JS object 
       * @param {string|Buffer} xmlData 
       * @param {boolean|Object} validationOption 
       */
      parse(xmlData, validationOption) {
        if (typeof xmlData === "string") {
        } else if (xmlData.toString) {
          xmlData = xmlData.toString();
        } else {
          throw new Error("XML data is accepted in String or Bytes[] form.");
        }
        if (validationOption) {
          if (validationOption === true) validationOption = {};
          const result = validator.validate(xmlData, validationOption);
          if (result !== true) {
            throw Error(`${result.err.msg}:${result.err.line}:${result.err.col}`);
          }
        }
        const orderedObjParser = new OrderedObjParser(this.options);
        orderedObjParser.addExternalEntities(this.externalEntities);
        const orderedResult = orderedObjParser.parseXml(xmlData);
        if (this.options.preserveOrder || orderedResult === void 0) return orderedResult;
        else return prettify(orderedResult, this.options);
      }
      /**
       * Add Entity which is not by default supported by this library
       * @param {string} key 
       * @param {string} value 
       */
      addEntity(key, value) {
        if (value.indexOf("&") !== -1) {
          throw new Error("Entity value can't have '&'");
        } else if (key.indexOf("&") !== -1 || key.indexOf(";") !== -1) {
          throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
        } else if (value === "&") {
          throw new Error("An entity with value '&' is not permitted");
        } else {
          this.externalEntities[key] = value;
        }
      }
    };
    module2.exports = XMLParser2;
  }
});

// node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js
var require_orderedJs2Xml = __commonJS({
  "node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js"(exports2, module2) {
    var EOL = "\n";
    function toXml(jArray, options) {
      let indentation = "";
      if (options.format && options.indentBy.length > 0) {
        indentation = EOL;
      }
      return arrToStr(jArray, options, "", indentation);
    }
    function arrToStr(arr, options, jPath, indentation) {
      let xmlStr = "";
      let isPreviousElementTag = false;
      if (!Array.isArray(arr)) {
        if (arr !== void 0 && arr !== null) {
          let text = arr.toString();
          text = replaceEntitiesValue(text, options);
          return text;
        }
        return "";
      }
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const tagName = propName(tagObj);
        if (tagName === void 0) continue;
        let newJPath = "";
        if (jPath.length === 0) newJPath = tagName;
        else newJPath = `${jPath}.${tagName}`;
        if (tagName === options.textNodeName) {
          let tagText = tagObj[tagName];
          if (!isStopNode(newJPath, options)) {
            tagText = options.tagValueProcessor(tagName, tagText);
            tagText = replaceEntitiesValue(tagText, options);
          }
          if (isPreviousElementTag) {
            xmlStr += indentation;
          }
          xmlStr += tagText;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.cdataPropName) {
          if (isPreviousElementTag) {
            xmlStr += indentation;
          }
          xmlStr += `<![CDATA[${tagObj[tagName][0][options.textNodeName]}]]>`;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.commentPropName) {
          xmlStr += indentation + `<!--${tagObj[tagName][0][options.textNodeName]}-->`;
          isPreviousElementTag = true;
          continue;
        } else if (tagName[0] === "?") {
          const attStr2 = attr_to_str(tagObj[":@"], options);
          const tempInd = tagName === "?xml" ? "" : indentation;
          let piTextNodeName = tagObj[tagName][0][options.textNodeName];
          piTextNodeName = piTextNodeName.length !== 0 ? " " + piTextNodeName : "";
          xmlStr += tempInd + `<${tagName}${piTextNodeName}${attStr2}?>`;
          isPreviousElementTag = true;
          continue;
        }
        let newIdentation = indentation;
        if (newIdentation !== "") {
          newIdentation += options.indentBy;
        }
        const attStr = attr_to_str(tagObj[":@"], options);
        const tagStart = indentation + `<${tagName}${attStr}`;
        const tagValue = arrToStr(tagObj[tagName], options, newJPath, newIdentation);
        if (options.unpairedTags.indexOf(tagName) !== -1) {
          if (options.suppressUnpairedNode) xmlStr += tagStart + ">";
          else xmlStr += tagStart + "/>";
        } else if ((!tagValue || tagValue.length === 0) && options.suppressEmptyNode) {
          xmlStr += tagStart + "/>";
        } else if (tagValue && tagValue.endsWith(">")) {
          xmlStr += tagStart + `>${tagValue}${indentation}</${tagName}>`;
        } else {
          xmlStr += tagStart + ">";
          if (tagValue && indentation !== "" && (tagValue.includes("/>") || tagValue.includes("</"))) {
            xmlStr += indentation + options.indentBy + tagValue + indentation;
          } else {
            xmlStr += tagValue;
          }
          xmlStr += `</${tagName}>`;
        }
        isPreviousElementTag = true;
      }
      return xmlStr;
    }
    function propName(obj) {
      const keys2 = Object.keys(obj);
      for (let i = 0; i < keys2.length; i++) {
        const key = keys2[i];
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        if (key !== ":@") return key;
      }
    }
    function attr_to_str(attrMap, options) {
      let attrStr = "";
      if (attrMap && !options.ignoreAttributes) {
        for (let attr in attrMap) {
          if (!Object.prototype.hasOwnProperty.call(attrMap, attr)) continue;
          let attrVal = options.attributeValueProcessor(attr, attrMap[attr]);
          attrVal = replaceEntitiesValue(attrVal, options);
          if (attrVal === true && options.suppressBooleanAttributes) {
            attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}`;
          } else {
            attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}="${attrVal}"`;
          }
        }
      }
      return attrStr;
    }
    function isStopNode(jPath, options) {
      jPath = jPath.substr(0, jPath.length - options.textNodeName.length - 1);
      let tagName = jPath.substr(jPath.lastIndexOf(".") + 1);
      for (let index in options.stopNodes) {
        if (options.stopNodes[index] === jPath || options.stopNodes[index] === "*." + tagName) return true;
      }
      return false;
    }
    function replaceEntitiesValue(textValue, options) {
      if (textValue && textValue.length > 0 && options.processEntities) {
        for (let i = 0; i < options.entities.length; i++) {
          const entity = options.entities[i];
          textValue = textValue.replace(entity.regex, entity.val);
        }
      }
      return textValue;
    }
    module2.exports = toXml;
  }
});

// node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js
var require_json2xml = __commonJS({
  "node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js"(exports2, module2) {
    "use strict";
    var buildFromOrderedJs = require_orderedJs2Xml();
    var getIgnoreAttributesFn = require_ignoreAttributes();
    var defaultOptions = {
      attributeNamePrefix: "@_",
      attributesGroupName: false,
      textNodeName: "#text",
      ignoreAttributes: true,
      cdataPropName: false,
      format: false,
      indentBy: "  ",
      suppressEmptyNode: false,
      suppressUnpairedNode: true,
      suppressBooleanAttributes: true,
      tagValueProcessor: function(key, a) {
        return a;
      },
      attributeValueProcessor: function(attrName, a) {
        return a;
      },
      preserveOrder: false,
      commentPropName: false,
      unpairedTags: [],
      entities: [
        { regex: new RegExp("&", "g"), val: "&amp;" },
        //it must be on top
        { regex: new RegExp(">", "g"), val: "&gt;" },
        { regex: new RegExp("<", "g"), val: "&lt;" },
        { regex: new RegExp("'", "g"), val: "&apos;" },
        { regex: new RegExp('"', "g"), val: "&quot;" }
      ],
      processEntities: true,
      stopNodes: [],
      // transformTagName: false,
      // transformAttributeName: false,
      oneListGroup: false
    };
    function Builder(options) {
      this.options = Object.assign({}, defaultOptions, options);
      if (this.options.ignoreAttributes === true || this.options.attributesGroupName) {
        this.isAttribute = function() {
          return false;
        };
      } else {
        this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
        this.attrPrefixLen = this.options.attributeNamePrefix.length;
        this.isAttribute = isAttribute;
      }
      this.processTextOrObjNode = processTextOrObjNode;
      if (this.options.format) {
        this.indentate = indentate;
        this.tagEndChar = ">\n";
        this.newLine = "\n";
      } else {
        this.indentate = function() {
          return "";
        };
        this.tagEndChar = ">";
        this.newLine = "";
      }
    }
    Builder.prototype.build = function(jObj) {
      if (this.options.preserveOrder) {
        return buildFromOrderedJs(jObj, this.options);
      } else {
        if (Array.isArray(jObj) && this.options.arrayNodeName && this.options.arrayNodeName.length > 1) {
          jObj = {
            [this.options.arrayNodeName]: jObj
          };
        }
        return this.j2x(jObj, 0, []).val;
      }
    };
    Builder.prototype.j2x = function(jObj, level, ajPath) {
      let attrStr = "";
      let val = "";
      const jPath = ajPath.join(".");
      for (let key in jObj) {
        if (!Object.prototype.hasOwnProperty.call(jObj, key)) continue;
        if (typeof jObj[key] === "undefined") {
          if (this.isAttribute(key)) {
            val += "";
          }
        } else if (jObj[key] === null) {
          if (this.isAttribute(key)) {
            val += "";
          } else if (key === this.options.cdataPropName) {
            val += "";
          } else if (key[0] === "?") {
            val += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
          } else {
            val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
          }
        } else if (jObj[key] instanceof Date) {
          val += this.buildTextValNode(jObj[key], key, "", level);
        } else if (typeof jObj[key] !== "object") {
          const attr = this.isAttribute(key);
          if (attr && !this.ignoreAttributesFn(attr, jPath)) {
            attrStr += this.buildAttrPairStr(attr, "" + jObj[key]);
          } else if (!attr) {
            if (key === this.options.textNodeName) {
              let newval = this.options.tagValueProcessor(key, "" + jObj[key]);
              val += this.replaceEntitiesValue(newval);
            } else {
              val += this.buildTextValNode(jObj[key], key, "", level);
            }
          }
        } else if (Array.isArray(jObj[key])) {
          const arrLen = jObj[key].length;
          let listTagVal = "";
          let listTagAttr = "";
          for (let j = 0; j < arrLen; j++) {
            const item = jObj[key][j];
            if (typeof item === "undefined") {
            } else if (item === null) {
              if (key[0] === "?") val += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
              else val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
            } else if (typeof item === "object") {
              if (this.options.oneListGroup) {
                const result = this.j2x(item, level + 1, ajPath.concat(key));
                listTagVal += result.val;
                if (this.options.attributesGroupName && item.hasOwnProperty(this.options.attributesGroupName)) {
                  listTagAttr += result.attrStr;
                }
              } else {
                listTagVal += this.processTextOrObjNode(item, key, level, ajPath);
              }
            } else {
              if (this.options.oneListGroup) {
                let textValue = this.options.tagValueProcessor(key, item);
                textValue = this.replaceEntitiesValue(textValue);
                listTagVal += textValue;
              } else {
                listTagVal += this.buildTextValNode(item, key, "", level);
              }
            }
          }
          if (this.options.oneListGroup) {
            listTagVal = this.buildObjectNode(listTagVal, key, listTagAttr, level);
          }
          val += listTagVal;
        } else {
          if (this.options.attributesGroupName && key === this.options.attributesGroupName) {
            const Ks = Object.keys(jObj[key]);
            const L = Ks.length;
            for (let j = 0; j < L; j++) {
              attrStr += this.buildAttrPairStr(Ks[j], "" + jObj[key][Ks[j]]);
            }
          } else {
            val += this.processTextOrObjNode(jObj[key], key, level, ajPath);
          }
        }
      }
      return { attrStr, val };
    };
    Builder.prototype.buildAttrPairStr = function(attrName, val) {
      val = this.options.attributeValueProcessor(attrName, "" + val);
      val = this.replaceEntitiesValue(val);
      if (this.options.suppressBooleanAttributes && val === "true") {
        return " " + attrName;
      } else return " " + attrName + '="' + val + '"';
    };
    function processTextOrObjNode(object, key, level, ajPath) {
      const result = this.j2x(object, level + 1, ajPath.concat(key));
      if (object[this.options.textNodeName] !== void 0 && Object.keys(object).length === 1) {
        return this.buildTextValNode(object[this.options.textNodeName], key, result.attrStr, level);
      } else {
        return this.buildObjectNode(result.val, key, result.attrStr, level);
      }
    }
    Builder.prototype.buildObjectNode = function(val, key, attrStr, level) {
      if (val === "") {
        if (key[0] === "?") return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
        else {
          return this.indentate(level) + "<" + key + attrStr + this.closeTag(key) + this.tagEndChar;
        }
      } else {
        let tagEndExp = "</" + key + this.tagEndChar;
        let piClosingChar = "";
        if (key[0] === "?") {
          piClosingChar = "?";
          tagEndExp = "";
        }
        if ((attrStr || attrStr === "") && val.indexOf("<") === -1) {
          return this.indentate(level) + "<" + key + attrStr + piClosingChar + ">" + val + tagEndExp;
        } else if (this.options.commentPropName !== false && key === this.options.commentPropName && piClosingChar.length === 0) {
          return this.indentate(level) + `<!--${val}-->` + this.newLine;
        } else {
          return this.indentate(level) + "<" + key + attrStr + piClosingChar + this.tagEndChar + val + this.indentate(level) + tagEndExp;
        }
      }
    };
    Builder.prototype.closeTag = function(key) {
      let closeTag = "";
      if (this.options.unpairedTags.indexOf(key) !== -1) {
        if (!this.options.suppressUnpairedNode) closeTag = "/";
      } else if (this.options.suppressEmptyNode) {
        closeTag = "/";
      } else {
        closeTag = `></${key}`;
      }
      return closeTag;
    };
    Builder.prototype.buildTextValNode = function(val, key, attrStr, level) {
      if (this.options.cdataPropName !== false && key === this.options.cdataPropName) {
        return this.indentate(level) + `<![CDATA[${val}]]>` + this.newLine;
      } else if (this.options.commentPropName !== false && key === this.options.commentPropName) {
        return this.indentate(level) + `<!--${val}-->` + this.newLine;
      } else if (key[0] === "?") {
        return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
      } else {
        let textValue = this.options.tagValueProcessor(key, val);
        textValue = this.replaceEntitiesValue(textValue);
        if (textValue === "") {
          return this.indentate(level) + "<" + key + attrStr + this.closeTag(key) + this.tagEndChar;
        } else {
          return this.indentate(level) + "<" + key + attrStr + ">" + textValue + "</" + key + this.tagEndChar;
        }
      }
    };
    Builder.prototype.replaceEntitiesValue = function(textValue) {
      if (textValue && textValue.length > 0 && this.options.processEntities) {
        for (let i = 0; i < this.options.entities.length; i++) {
          const entity = this.options.entities[i];
          textValue = textValue.replace(entity.regex, entity.val);
        }
      }
      return textValue;
    };
    function indentate(level) {
      return this.options.indentBy.repeat(level);
    }
    function isAttribute(name) {
      if (name.startsWith(this.options.attributeNamePrefix) && name !== this.options.textNodeName) {
        return name.substr(this.attrPrefixLen);
      } else {
        return false;
      }
    }
    module2.exports = Builder;
  }
});

// node_modules/fast-xml-parser/src/fxp.js
var require_fxp = __commonJS({
  "node_modules/fast-xml-parser/src/fxp.js"(exports2, module2) {
    "use strict";
    var validator = require_validator();
    var XMLParser2 = require_XMLParser();
    var XMLBuilder = require_json2xml();
    module2.exports = {
      XMLParser: XMLParser2,
      XMLValidator: validator,
      XMLBuilder
    };
  }
});

// src/tools/cardmirror-read-cli.ts
var import_node_fs3 = require("node:fs");
var import_node_os = require("node:os");
var import_node_path3 = require("node:path");

// node_modules/orderedmap/dist/index.js
function OrderedMap(content) {
  this.content = content;
}
OrderedMap.prototype = {
  constructor: OrderedMap,
  find: function(key) {
    for (var i = 0; i < this.content.length; i += 2)
      if (this.content[i] === key) return i;
    return -1;
  },
  // :: (string) → ?any
  // Retrieve the value stored under `key`, or return undefined when
  // no such key exists.
  get: function(key) {
    var found2 = this.find(key);
    return found2 == -1 ? void 0 : this.content[found2 + 1];
  },
  // :: (string, any, ?string) → OrderedMap
  // Create a new map by replacing the value of `key` with a new
  // value, or adding a binding to the end of the map. If `newKey` is
  // given, the key of the binding will be replaced with that key.
  update: function(key, value, newKey) {
    var self = newKey && newKey != key ? this.remove(newKey) : this;
    var found2 = self.find(key), content = self.content.slice();
    if (found2 == -1) {
      content.push(newKey || key, value);
    } else {
      content[found2 + 1] = value;
      if (newKey) content[found2] = newKey;
    }
    return new OrderedMap(content);
  },
  // :: (string) → OrderedMap
  // Return a map with the given key removed, if it existed.
  remove: function(key) {
    var found2 = this.find(key);
    if (found2 == -1) return this;
    var content = this.content.slice();
    content.splice(found2, 2);
    return new OrderedMap(content);
  },
  // :: (string, any) → OrderedMap
  // Add a new key to the start of the map.
  addToStart: function(key, value) {
    return new OrderedMap([key, value].concat(this.remove(key).content));
  },
  // :: (string, any) → OrderedMap
  // Add a new key to the end of the map.
  addToEnd: function(key, value) {
    var content = this.remove(key).content.slice();
    content.push(key, value);
    return new OrderedMap(content);
  },
  // :: (string, string, any) → OrderedMap
  // Add a key after the given key. If `place` is not found, the new
  // key is added to the end.
  addBefore: function(place, key, value) {
    var without = this.remove(key), content = without.content.slice();
    var found2 = without.find(place);
    content.splice(found2 == -1 ? content.length : found2, 0, key, value);
    return new OrderedMap(content);
  },
  // :: ((key: string, value: any))
  // Call the given function for each key/value pair in the map, in
  // order.
  forEach: function(f) {
    for (var i = 0; i < this.content.length; i += 2)
      f(this.content[i], this.content[i + 1]);
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by prepending the keys in this map that don't
  // appear in `map` before the keys in `map`.
  prepend: function(map) {
    map = OrderedMap.from(map);
    if (!map.size) return this;
    return new OrderedMap(map.content.concat(this.subtract(map).content));
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by appending the keys in this map that don't
  // appear in `map` after the keys in `map`.
  append: function(map) {
    map = OrderedMap.from(map);
    if (!map.size) return this;
    return new OrderedMap(this.subtract(map).content.concat(map.content));
  },
  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a map containing all the keys in this map that don't
  // appear in `map`.
  subtract: function(map) {
    var result = this;
    map = OrderedMap.from(map);
    for (var i = 0; i < map.content.length; i += 2)
      result = result.remove(map.content[i]);
    return result;
  },
  // :: () → Object
  // Turn ordered map into a plain object.
  toObject: function() {
    var result = {};
    this.forEach(function(key, value) {
      result[key] = value;
    });
    return result;
  },
  // :: number
  // The amount of keys in this map.
  get size() {
    return this.content.length >> 1;
  }
};
OrderedMap.from = function(value) {
  if (value instanceof OrderedMap) return value;
  var content = [];
  if (value) for (var prop in value) content.push(prop, value[prop]);
  return new OrderedMap(content);
};
var dist_default = OrderedMap;

// node_modules/prosemirror-model/dist/index.js
function findDiffStart(a, b, pos) {
  for (let i = 0; ; i++) {
    if (i == a.childCount || i == b.childCount)
      return a.childCount == b.childCount ? null : pos;
    let childA = a.child(i), childB = b.child(i);
    if (childA == childB) {
      pos += childA.nodeSize;
      continue;
    }
    if (!childA.sameMarkup(childB))
      return pos;
    if (childA.isText && childA.text != childB.text) {
      for (let j = 0; childA.text[j] == childB.text[j]; j++)
        pos++;
      return pos;
    }
    if (childA.content.size || childB.content.size) {
      let inner = findDiffStart(childA.content, childB.content, pos + 1);
      if (inner != null)
        return inner;
    }
    pos += childA.nodeSize;
  }
}
function findDiffEnd(a, b, posA, posB) {
  for (let iA = a.childCount, iB = b.childCount; ; ) {
    if (iA == 0 || iB == 0)
      return iA == iB ? null : { a: posA, b: posB };
    let childA = a.child(--iA), childB = b.child(--iB), size = childA.nodeSize;
    if (childA == childB) {
      posA -= size;
      posB -= size;
      continue;
    }
    if (!childA.sameMarkup(childB))
      return { a: posA, b: posB };
    if (childA.isText && childA.text != childB.text) {
      let same = 0, minSize = Math.min(childA.text.length, childB.text.length);
      while (same < minSize && childA.text[childA.text.length - same - 1] == childB.text[childB.text.length - same - 1]) {
        same++;
        posA--;
        posB--;
      }
      return { a: posA, b: posB };
    }
    if (childA.content.size || childB.content.size) {
      let inner = findDiffEnd(childA.content, childB.content, posA - 1, posB - 1);
      if (inner)
        return inner;
    }
    posA -= size;
    posB -= size;
  }
}
var Fragment = class _Fragment {
  /**
  @internal
  */
  constructor(content, size) {
    this.content = content;
    this.size = size || 0;
    if (size == null)
      for (let i = 0; i < content.length; i++)
        this.size += content[i].nodeSize;
  }
  /**
  Invoke a callback for all descendant nodes between the given two
  positions (relative to start of this fragment). Doesn't descend
  into a node when the callback returns `false`.
  */
  nodesBetween(from, to, f, nodeStart = 0, parent) {
    for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i], end = pos + child.nodeSize;
      if (end > from && f(child, nodeStart + pos, parent || null, i) !== false && child.content.size) {
        let start = pos + 1;
        child.nodesBetween(Math.max(0, from - start), Math.min(child.content.size, to - start), f, nodeStart + start);
      }
      pos = end;
    }
  }
  /**
  Call the given callback for every descendant node. `pos` will be
  relative to the start of the fragment. The callback may return
  `false` to prevent traversal of a given node's children.
  */
  descendants(f) {
    this.nodesBetween(0, this.size, f);
  }
  /**
  Extract the text between `from` and `to`. See the same method on
  [`Node`](https://prosemirror.net/docs/ref/#model.Node.textBetween).
  */
  textBetween(from, to, blockSeparator, leafText) {
    let text = "", first = true;
    this.nodesBetween(from, to, (node, pos) => {
      let nodeText = node.isText ? node.text.slice(Math.max(from, pos) - pos, to - pos) : !node.isLeaf ? "" : leafText ? typeof leafText === "function" ? leafText(node) : leafText : node.type.spec.leafText ? node.type.spec.leafText(node) : "";
      if (node.isBlock && (node.isLeaf && nodeText || node.isTextblock) && blockSeparator) {
        if (first)
          first = false;
        else
          text += blockSeparator;
      }
      text += nodeText;
    }, 0);
    return text;
  }
  /**
  Create a new fragment containing the combined content of this
  fragment and the other.
  */
  append(other) {
    if (!other.size)
      return this;
    if (!this.size)
      return other;
    let last = this.lastChild, first = other.firstChild, content = this.content.slice(), i = 0;
    if (last.isText && last.sameMarkup(first)) {
      content[content.length - 1] = last.withText(last.text + first.text);
      i = 1;
    }
    for (; i < other.content.length; i++)
      content.push(other.content[i]);
    return new _Fragment(content, this.size + other.size);
  }
  /**
  Cut out the sub-fragment between the two given positions.
  */
  cut(from, to = this.size) {
    if (from == 0 && to == this.size)
      return this;
    let result = [], size = 0;
    if (to > from)
      for (let i = 0, pos = 0; pos < to; i++) {
        let child = this.content[i], end = pos + child.nodeSize;
        if (end > from) {
          if (pos < from || end > to) {
            if (child.isText)
              child = child.cut(Math.max(0, from - pos), Math.min(child.text.length, to - pos));
            else
              child = child.cut(Math.max(0, from - pos - 1), Math.min(child.content.size, to - pos - 1));
          }
          result.push(child);
          size += child.nodeSize;
        }
        pos = end;
      }
    return new _Fragment(result, size);
  }
  /**
  @internal
  */
  cutByIndex(from, to) {
    if (from == to)
      return _Fragment.empty;
    if (from == 0 && to == this.content.length)
      return this;
    return new _Fragment(this.content.slice(from, to));
  }
  /**
  Create a new fragment in which the node at the given index is
  replaced by the given node.
  */
  replaceChild(index, node) {
    let current = this.content[index];
    if (current == node)
      return this;
    let copy = this.content.slice();
    let size = this.size + node.nodeSize - current.nodeSize;
    copy[index] = node;
    return new _Fragment(copy, size);
  }
  /**
  Create a new fragment by prepending the given node to this
  fragment.
  */
  addToStart(node) {
    return new _Fragment([node].concat(this.content), this.size + node.nodeSize);
  }
  /**
  Create a new fragment by appending the given node to this
  fragment.
  */
  addToEnd(node) {
    return new _Fragment(this.content.concat(node), this.size + node.nodeSize);
  }
  /**
  Compare this fragment to another one.
  */
  eq(other) {
    if (this.content.length != other.content.length)
      return false;
    for (let i = 0; i < this.content.length; i++)
      if (!this.content[i].eq(other.content[i]))
        return false;
    return true;
  }
  /**
  The first child of the fragment, or `null` if it is empty.
  */
  get firstChild() {
    return this.content.length ? this.content[0] : null;
  }
  /**
  The last child of the fragment, or `null` if it is empty.
  */
  get lastChild() {
    return this.content.length ? this.content[this.content.length - 1] : null;
  }
  /**
  The number of child nodes in this fragment.
  */
  get childCount() {
    return this.content.length;
  }
  /**
  Get the child node at the given index. Raise an error when the
  index is out of range.
  */
  child(index) {
    let found2 = this.content[index];
    if (!found2)
      throw new RangeError("Index " + index + " out of range for " + this);
    return found2;
  }
  /**
  Get the child node at the given index, if it exists.
  */
  maybeChild(index) {
    return this.content[index] || null;
  }
  /**
  Call `f` for every child node, passing the node, its offset
  into this parent node, and its index.
  */
  forEach(f) {
    for (let i = 0, p = 0; i < this.content.length; i++) {
      let child = this.content[i];
      f(child, p, i);
      p += child.nodeSize;
    }
  }
  /**
  Find the first position at which this fragment and another
  fragment differ, or `null` if they are the same.
  */
  findDiffStart(other, pos = 0) {
    return findDiffStart(this, other, pos);
  }
  /**
  Find the first position, searching from the end, at which this
  fragment and the given fragment differ, or `null` if they are
  the same. Since this position will not be the same in both
  nodes, an object with two separate positions is returned.
  */
  findDiffEnd(other, pos = this.size, otherPos = other.size) {
    return findDiffEnd(this, other, pos, otherPos);
  }
  /**
  Find the index and inner offset corresponding to a given relative
  position in this fragment. The result object will be reused
  (overwritten) the next time the function is called. @internal
  */
  findIndex(pos) {
    if (pos == 0)
      return retIndex(0, pos);
    if (pos == this.size)
      return retIndex(this.content.length, pos);
    if (pos > this.size || pos < 0)
      throw new RangeError(`Position ${pos} outside of fragment (${this})`);
    for (let i = 0, curPos = 0; ; i++) {
      let cur = this.child(i), end = curPos + cur.nodeSize;
      if (end >= pos) {
        if (end == pos)
          return retIndex(i + 1, end);
        return retIndex(i, curPos);
      }
      curPos = end;
    }
  }
  /**
  Return a debugging string that describes this fragment.
  */
  toString() {
    return "<" + this.toStringInner() + ">";
  }
  /**
  @internal
  */
  toStringInner() {
    return this.content.join(", ");
  }
  /**
  Create a JSON-serializeable representation of this fragment.
  */
  toJSON() {
    return this.content.length ? this.content.map((n) => n.toJSON()) : null;
  }
  /**
  Deserialize a fragment from its JSON representation.
  */
  static fromJSON(schema2, value) {
    if (!value)
      return _Fragment.empty;
    if (!Array.isArray(value))
      throw new RangeError("Invalid input for Fragment.fromJSON");
    return new _Fragment(value.map(schema2.nodeFromJSON));
  }
  /**
  Build a fragment from an array of nodes. Ensures that adjacent
  text nodes with the same marks are joined together.
  */
  static fromArray(array) {
    if (!array.length)
      return _Fragment.empty;
    let joined, size = 0;
    for (let i = 0; i < array.length; i++) {
      let node = array[i];
      size += node.nodeSize;
      if (i && node.isText && array[i - 1].sameMarkup(node)) {
        if (!joined)
          joined = array.slice(0, i);
        joined[joined.length - 1] = node.withText(joined[joined.length - 1].text + node.text);
      } else if (joined) {
        joined.push(node);
      }
    }
    return new _Fragment(joined || array, size);
  }
  /**
  Create a fragment from something that can be interpreted as a
  set of nodes. For `null`, it returns the empty fragment. For a
  fragment, the fragment itself. For a node or array of nodes, a
  fragment containing those nodes.
  */
  static from(nodes2) {
    if (!nodes2)
      return _Fragment.empty;
    if (nodes2 instanceof _Fragment)
      return nodes2;
    if (Array.isArray(nodes2))
      return this.fromArray(nodes2);
    if (nodes2.attrs)
      return new _Fragment([nodes2], nodes2.nodeSize);
    throw new RangeError("Can not convert " + nodes2 + " to a Fragment" + (nodes2.nodesBetween ? " (looks like multiple versions of prosemirror-model were loaded)" : ""));
  }
};
Fragment.empty = new Fragment([], 0);
var found = { index: 0, offset: 0 };
function retIndex(index, offset) {
  found.index = index;
  found.offset = offset;
  return found;
}
function compareDeep(a, b) {
  if (a === b)
    return true;
  if (!(a && typeof a == "object") || !(b && typeof b == "object"))
    return false;
  let array = Array.isArray(a);
  if (Array.isArray(b) != array)
    return false;
  if (array) {
    if (a.length != b.length)
      return false;
    for (let i = 0; i < a.length; i++)
      if (!compareDeep(a[i], b[i]))
        return false;
  } else {
    for (let p in a)
      if (!(p in b) || !compareDeep(a[p], b[p]))
        return false;
    for (let p in b)
      if (!(p in a))
        return false;
  }
  return true;
}
var Mark = class _Mark {
  /**
  @internal
  */
  constructor(type, attrs2) {
    this.type = type;
    this.attrs = attrs2;
  }
  /**
  Given a set of marks, create a new set which contains this one as
  well, in the right position. If this mark is already in the set,
  the set itself is returned. If any marks that are set to be
  [exclusive](https://prosemirror.net/docs/ref/#model.MarkSpec.excludes) with this mark are present,
  those are replaced by this one.
  */
  addToSet(set) {
    let copy, placed = false;
    for (let i = 0; i < set.length; i++) {
      let other = set[i];
      if (this.eq(other))
        return set;
      if (this.type.excludes(other.type)) {
        if (!copy)
          copy = set.slice(0, i);
      } else if (other.type.excludes(this.type)) {
        return set;
      } else {
        if (!placed && other.type.rank > this.type.rank) {
          if (!copy)
            copy = set.slice(0, i);
          copy.push(this);
          placed = true;
        }
        if (copy)
          copy.push(other);
      }
    }
    if (!copy)
      copy = set.slice();
    if (!placed)
      copy.push(this);
    return copy;
  }
  /**
  Remove this mark from the given set, returning a new set. If this
  mark is not in the set, the set itself is returned.
  */
  removeFromSet(set) {
    for (let i = 0; i < set.length; i++)
      if (this.eq(set[i]))
        return set.slice(0, i).concat(set.slice(i + 1));
    return set;
  }
  /**
  Test whether this mark is in the given set of marks.
  */
  isInSet(set) {
    for (let i = 0; i < set.length; i++)
      if (this.eq(set[i]))
        return true;
    return false;
  }
  /**
  Test whether this mark has the same type and attributes as
  another mark.
  */
  eq(other) {
    return this == other || this.type == other.type && compareDeep(this.attrs, other.attrs);
  }
  /**
  Convert this mark to a JSON-serializeable representation.
  */
  toJSON() {
    let obj = { type: this.type.name };
    for (let _ in this.attrs) {
      obj.attrs = this.attrs;
      break;
    }
    return obj;
  }
  /**
  Deserialize a mark from JSON.
  */
  static fromJSON(schema2, json) {
    if (!json)
      throw new RangeError("Invalid input for Mark.fromJSON");
    let type = schema2.marks[json.type];
    if (!type)
      throw new RangeError(`There is no mark type ${json.type} in this schema`);
    let mark = type.create(json.attrs);
    type.checkAttrs(mark.attrs);
    return mark;
  }
  /**
  Test whether two sets of marks are identical.
  */
  static sameSet(a, b) {
    if (a == b)
      return true;
    if (a.length != b.length)
      return false;
    for (let i = 0; i < a.length; i++)
      if (!a[i].eq(b[i]))
        return false;
    return true;
  }
  /**
  Create a properly sorted mark set from null, a single mark, or an
  unsorted array of marks.
  */
  static setFrom(marks2) {
    if (!marks2 || Array.isArray(marks2) && marks2.length == 0)
      return _Mark.none;
    if (marks2 instanceof _Mark)
      return [marks2];
    let copy = marks2.slice();
    copy.sort((a, b) => a.type.rank - b.type.rank);
    return copy;
  }
};
Mark.none = [];
var ReplaceError = class extends Error {
};
var Slice = class _Slice {
  /**
  Create a slice. When specifying a non-zero open depth, you must
  make sure that there are nodes of at least that depth at the
  appropriate side of the fragment—i.e. if the fragment is an
  empty paragraph node, `openStart` and `openEnd` can't be greater
  than 1.
  
  It is not necessary for the content of open nodes to conform to
  the schema's content constraints, though it should be a valid
  start/end/middle for such a node, depending on which sides are
  open.
  */
  constructor(content, openStart, openEnd) {
    this.content = content;
    this.openStart = openStart;
    this.openEnd = openEnd;
  }
  /**
  The size this slice would add when inserted into a document.
  */
  get size() {
    return this.content.size - this.openStart - this.openEnd;
  }
  /**
  @internal
  */
  insertAt(pos, fragment) {
    let content = insertInto(this.content, pos + this.openStart, fragment);
    return content && new _Slice(content, this.openStart, this.openEnd);
  }
  /**
  @internal
  */
  removeBetween(from, to) {
    return new _Slice(removeRange(this.content, from + this.openStart, to + this.openStart), this.openStart, this.openEnd);
  }
  /**
  Tests whether this slice is equal to another slice.
  */
  eq(other) {
    return this.content.eq(other.content) && this.openStart == other.openStart && this.openEnd == other.openEnd;
  }
  /**
  @internal
  */
  toString() {
    return this.content + "(" + this.openStart + "," + this.openEnd + ")";
  }
  /**
  Convert a slice to a JSON-serializable representation.
  */
  toJSON() {
    if (!this.content.size)
      return null;
    let json = { content: this.content.toJSON() };
    if (this.openStart > 0)
      json.openStart = this.openStart;
    if (this.openEnd > 0)
      json.openEnd = this.openEnd;
    return json;
  }
  /**
  Deserialize a slice from its JSON representation.
  */
  static fromJSON(schema2, json) {
    if (!json)
      return _Slice.empty;
    let openStart = json.openStart || 0, openEnd = json.openEnd || 0;
    if (typeof openStart != "number" || typeof openEnd != "number")
      throw new RangeError("Invalid input for Slice.fromJSON");
    return new _Slice(Fragment.fromJSON(schema2, json.content), openStart, openEnd);
  }
  /**
  Create a slice from a fragment by taking the maximum possible
  open value on both side of the fragment.
  */
  static maxOpen(fragment, openIsolating = true) {
    let openStart = 0, openEnd = 0;
    for (let n = fragment.firstChild; n && !n.isLeaf && (openIsolating || !n.type.spec.isolating); n = n.firstChild)
      openStart++;
    for (let n = fragment.lastChild; n && !n.isLeaf && (openIsolating || !n.type.spec.isolating); n = n.lastChild)
      openEnd++;
    return new _Slice(fragment, openStart, openEnd);
  }
};
Slice.empty = new Slice(Fragment.empty, 0, 0);
function removeRange(content, from, to) {
  let { index, offset } = content.findIndex(from), child = content.maybeChild(index);
  let { index: indexTo, offset: offsetTo } = content.findIndex(to);
  if (offset == from || child.isText) {
    if (offsetTo != to && !content.child(indexTo).isText)
      throw new RangeError("Removing non-flat range");
    return content.cut(0, from).append(content.cut(to));
  }
  if (index != indexTo)
    throw new RangeError("Removing non-flat range");
  return content.replaceChild(index, child.copy(removeRange(child.content, from - offset - 1, to - offset - 1)));
}
function insertInto(content, dist, insert, parent) {
  let { index, offset } = content.findIndex(dist), child = content.maybeChild(index);
  if (offset == dist || child.isText) {
    if (parent && !parent.canReplace(index, index, insert))
      return null;
    return content.cut(0, dist).append(insert).append(content.cut(dist));
  }
  let inner = insertInto(child.content, dist - offset - 1, insert, child);
  return inner && content.replaceChild(index, child.copy(inner));
}
function replace($from, $to, slice) {
  if (slice.openStart > $from.depth)
    throw new ReplaceError("Inserted content deeper than insertion position");
  if ($from.depth - slice.openStart != $to.depth - slice.openEnd)
    throw new ReplaceError("Inconsistent open depths");
  return replaceOuter($from, $to, slice, 0);
}
function replaceOuter($from, $to, slice, depth) {
  let index = $from.index(depth), node = $from.node(depth);
  if (index == $to.index(depth) && depth < $from.depth - slice.openStart) {
    let inner = replaceOuter($from, $to, slice, depth + 1);
    return node.copy(node.content.replaceChild(index, inner));
  } else if (!slice.content.size) {
    return close(node, replaceTwoWay($from, $to, depth));
  } else if (!slice.openStart && !slice.openEnd && $from.depth == depth && $to.depth == depth) {
    let parent = $from.parent, content = parent.content;
    return close(parent, content.cut(0, $from.parentOffset).append(slice.content).append(content.cut($to.parentOffset)));
  } else {
    let { start, end } = prepareSliceForReplace(slice, $from);
    return close(node, replaceThreeWay($from, start, end, $to, depth));
  }
}
function checkJoin(main2, sub) {
  if (!sub.type.compatibleContent(main2.type))
    throw new ReplaceError("Cannot join " + sub.type.name + " onto " + main2.type.name);
}
function joinable($before, $after, depth) {
  let node = $before.node(depth);
  checkJoin(node, $after.node(depth));
  return node;
}
function addNode(child, target) {
  let last = target.length - 1;
  if (last >= 0 && child.isText && child.sameMarkup(target[last]))
    target[last] = child.withText(target[last].text + child.text);
  else
    target.push(child);
}
function addRange($start, $end, depth, target) {
  let node = ($end || $start).node(depth);
  let startIndex = 0, endIndex = $end ? $end.index(depth) : node.childCount;
  if ($start) {
    startIndex = $start.index(depth);
    if ($start.depth > depth) {
      startIndex++;
    } else if ($start.textOffset) {
      addNode($start.nodeAfter, target);
      startIndex++;
    }
  }
  for (let i = startIndex; i < endIndex; i++)
    addNode(node.child(i), target);
  if ($end && $end.depth == depth && $end.textOffset)
    addNode($end.nodeBefore, target);
}
function close(node, content) {
  node.type.checkContent(content);
  return node.copy(content);
}
function replaceThreeWay($from, $start, $end, $to, depth) {
  let openStart = $from.depth > depth && joinable($from, $start, depth + 1);
  let openEnd = $to.depth > depth && joinable($end, $to, depth + 1);
  let content = [];
  addRange(null, $from, depth, content);
  if (openStart && openEnd && $start.index(depth) == $end.index(depth)) {
    checkJoin(openStart, openEnd);
    addNode(close(openStart, replaceThreeWay($from, $start, $end, $to, depth + 1)), content);
  } else {
    if (openStart)
      addNode(close(openStart, replaceTwoWay($from, $start, depth + 1)), content);
    addRange($start, $end, depth, content);
    if (openEnd)
      addNode(close(openEnd, replaceTwoWay($end, $to, depth + 1)), content);
  }
  addRange($to, null, depth, content);
  return new Fragment(content);
}
function replaceTwoWay($from, $to, depth) {
  let content = [];
  addRange(null, $from, depth, content);
  if ($from.depth > depth) {
    let type = joinable($from, $to, depth + 1);
    addNode(close(type, replaceTwoWay($from, $to, depth + 1)), content);
  }
  addRange($to, null, depth, content);
  return new Fragment(content);
}
function prepareSliceForReplace(slice, $along) {
  let extra = $along.depth - slice.openStart, parent = $along.node(extra);
  let node = parent.copy(slice.content);
  for (let i = extra - 1; i >= 0; i--)
    node = $along.node(i).copy(Fragment.from(node));
  return {
    start: node.resolveNoCache(slice.openStart + extra),
    end: node.resolveNoCache(node.content.size - slice.openEnd - extra)
  };
}
var ResolvedPos = class _ResolvedPos {
  /**
  @internal
  */
  constructor(pos, path, parentOffset) {
    this.pos = pos;
    this.path = path;
    this.parentOffset = parentOffset;
    this.depth = path.length / 3 - 1;
  }
  /**
  @internal
  */
  resolveDepth(val) {
    if (val == null)
      return this.depth;
    if (val < 0)
      return this.depth + val;
    return val;
  }
  /**
  The parent node that the position points into. Note that even if
  a position points into a text node, that node is not considered
  the parent—text nodes are ‘flat’ in this model, and have no content.
  */
  get parent() {
    return this.node(this.depth);
  }
  /**
  The root node in which the position was resolved.
  */
  get doc() {
    return this.node(0);
  }
  /**
  The ancestor node at the given level. `p.node(p.depth)` is the
  same as `p.parent`.
  */
  node(depth) {
    return this.path[this.resolveDepth(depth) * 3];
  }
  /**
  The index into the ancestor at the given level. If this points
  at the 3rd node in the 2nd paragraph on the top level, for
  example, `p.index(0)` is 1 and `p.index(1)` is 2.
  */
  index(depth) {
    return this.path[this.resolveDepth(depth) * 3 + 1];
  }
  /**
  The index pointing after this position into the ancestor at the
  given level.
  */
  indexAfter(depth) {
    depth = this.resolveDepth(depth);
    return this.index(depth) + (depth == this.depth && !this.textOffset ? 0 : 1);
  }
  /**
  The (absolute) position at the start of the node at the given
  level.
  */
  start(depth) {
    depth = this.resolveDepth(depth);
    return depth == 0 ? 0 : this.path[depth * 3 - 1] + 1;
  }
  /**
  The (absolute) position at the end of the node at the given
  level.
  */
  end(depth) {
    depth = this.resolveDepth(depth);
    return this.start(depth) + this.node(depth).content.size;
  }
  /**
  The (absolute) position directly before the wrapping node at the
  given level, or, when `depth` is `this.depth + 1`, the original
  position.
  */
  before(depth) {
    depth = this.resolveDepth(depth);
    if (!depth)
      throw new RangeError("There is no position before the top-level node");
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1];
  }
  /**
  The (absolute) position directly after the wrapping node at the
  given level, or the original position when `depth` is `this.depth + 1`.
  */
  after(depth) {
    depth = this.resolveDepth(depth);
    if (!depth)
      throw new RangeError("There is no position after the top-level node");
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1] + this.path[depth * 3].nodeSize;
  }
  /**
  When this position points into a text node, this returns the
  distance between the position and the start of the text node.
  Will be zero for positions that point between nodes.
  */
  get textOffset() {
    return this.pos - this.path[this.path.length - 1];
  }
  /**
  Get the node directly after the position, if any. If the position
  points into a text node, only the part of that node after the
  position is returned.
  */
  get nodeAfter() {
    let parent = this.parent, index = this.index(this.depth);
    if (index == parent.childCount)
      return null;
    let dOff = this.pos - this.path[this.path.length - 1], child = parent.child(index);
    return dOff ? parent.child(index).cut(dOff) : child;
  }
  /**
  Get the node directly before the position, if any. If the
  position points into a text node, only the part of that node
  before the position is returned.
  */
  get nodeBefore() {
    let index = this.index(this.depth);
    let dOff = this.pos - this.path[this.path.length - 1];
    if (dOff)
      return this.parent.child(index).cut(0, dOff);
    return index == 0 ? null : this.parent.child(index - 1);
  }
  /**
  Get the position at the given index in the parent node at the
  given depth (which defaults to `this.depth`).
  */
  posAtIndex(index, depth) {
    depth = this.resolveDepth(depth);
    let node = this.path[depth * 3], pos = depth == 0 ? 0 : this.path[depth * 3 - 1] + 1;
    for (let i = 0; i < index; i++)
      pos += node.child(i).nodeSize;
    return pos;
  }
  /**
  Get the marks at this position, factoring in the surrounding
  marks' [`inclusive`](https://prosemirror.net/docs/ref/#model.MarkSpec.inclusive) property. If the
  position is at the start of a non-empty node, the marks of the
  node after it (if any) are returned.
  */
  marks() {
    let parent = this.parent, index = this.index();
    if (parent.content.size == 0)
      return Mark.none;
    if (this.textOffset)
      return parent.child(index).marks;
    let main2 = parent.maybeChild(index - 1), other = parent.maybeChild(index);
    if (!main2) {
      let tmp = main2;
      main2 = other;
      other = tmp;
    }
    let marks2 = main2.marks;
    for (var i = 0; i < marks2.length; i++)
      if (marks2[i].type.spec.inclusive === false && (!other || !marks2[i].isInSet(other.marks)))
        marks2 = marks2[i--].removeFromSet(marks2);
    return marks2;
  }
  /**
  Get the marks after the current position, if any, except those
  that are non-inclusive and not present at position `$end`. This
  is mostly useful for getting the set of marks to preserve after a
  deletion. Will return `null` if this position is at the end of
  its parent node or its parent node isn't a textblock (in which
  case no marks should be preserved).
  */
  marksAcross($end) {
    let after = this.parent.maybeChild(this.index());
    if (!after || !after.isInline)
      return null;
    let marks2 = after.marks, next = $end.parent.maybeChild($end.index());
    for (var i = 0; i < marks2.length; i++)
      if (marks2[i].type.spec.inclusive === false && (!next || !marks2[i].isInSet(next.marks)))
        marks2 = marks2[i--].removeFromSet(marks2);
    return marks2;
  }
  /**
  The depth up to which this position and the given (non-resolved)
  position share the same parent nodes.
  */
  sharedDepth(pos) {
    for (let depth = this.depth; depth > 0; depth--)
      if (this.start(depth) <= pos && this.end(depth) >= pos)
        return depth;
    return 0;
  }
  /**
  Returns a range based on the place where this position and the
  given position diverge around block content. If both point into
  the same textblock, for example, a range around that textblock
  will be returned. If they point into different blocks, the range
  around those blocks in their shared ancestor is returned. You can
  pass in an optional predicate that will be called with a parent
  node to see if a range into that parent is acceptable.
  */
  blockRange(other = this, pred) {
    if (other.pos < this.pos)
      return other.blockRange(this);
    for (let d = this.depth - (this.parent.inlineContent || this.pos == other.pos ? 1 : 0); d >= 0; d--)
      if (other.pos <= this.end(d) && (!pred || pred(this.node(d))))
        return new NodeRange(this, other, d);
    return null;
  }
  /**
  Query whether the given position shares the same parent node.
  */
  sameParent(other) {
    return this.pos - this.parentOffset == other.pos - other.parentOffset;
  }
  /**
  Return the greater of this and the given position.
  */
  max(other) {
    return other.pos > this.pos ? other : this;
  }
  /**
  Return the smaller of this and the given position.
  */
  min(other) {
    return other.pos < this.pos ? other : this;
  }
  /**
  @internal
  */
  toString() {
    let str = "";
    for (let i = 1; i <= this.depth; i++)
      str += (str ? "/" : "") + this.node(i).type.name + "_" + this.index(i - 1);
    return str + ":" + this.parentOffset;
  }
  /**
  @internal
  */
  static resolve(doc, pos) {
    if (!(pos >= 0 && pos <= doc.content.size))
      throw new RangeError("Position " + pos + " out of range");
    let path = [];
    let start = 0, parentOffset = pos;
    for (let node = doc; ; ) {
      let { index, offset } = node.content.findIndex(parentOffset);
      let rem = parentOffset - offset;
      path.push(node, index, start + offset);
      if (!rem)
        break;
      node = node.child(index);
      if (node.isText)
        break;
      parentOffset = rem - 1;
      start += offset + 1;
    }
    return new _ResolvedPos(pos, path, parentOffset);
  }
  /**
  @internal
  */
  static resolveCached(doc, pos) {
    let cache = resolveCache.get(doc);
    if (cache) {
      for (let i = 0; i < cache.elts.length; i++) {
        let elt = cache.elts[i];
        if (elt.pos == pos)
          return elt;
      }
    } else {
      resolveCache.set(doc, cache = new ResolveCache());
    }
    let result = cache.elts[cache.i] = _ResolvedPos.resolve(doc, pos);
    cache.i = (cache.i + 1) % resolveCacheSize;
    return result;
  }
};
var ResolveCache = class {
  constructor() {
    this.elts = [];
    this.i = 0;
  }
};
var resolveCacheSize = 12;
var resolveCache = /* @__PURE__ */ new WeakMap();
var NodeRange = class {
  /**
  Construct a node range. `$from` and `$to` should point into the
  same node until at least the given `depth`, since a node range
  denotes an adjacent set of nodes in a single parent node.
  */
  constructor($from, $to, depth) {
    this.$from = $from;
    this.$to = $to;
    this.depth = depth;
  }
  /**
  The position at the start of the range.
  */
  get start() {
    return this.$from.before(this.depth + 1);
  }
  /**
  The position at the end of the range.
  */
  get end() {
    return this.$to.after(this.depth + 1);
  }
  /**
  The parent node that the range points into.
  */
  get parent() {
    return this.$from.node(this.depth);
  }
  /**
  The start index of the range in the parent node.
  */
  get startIndex() {
    return this.$from.index(this.depth);
  }
  /**
  The end index of the range in the parent node.
  */
  get endIndex() {
    return this.$to.indexAfter(this.depth);
  }
};
var emptyAttrs = /* @__PURE__ */ Object.create(null);
var Node = class _Node {
  /**
  @internal
  */
  constructor(type, attrs2, content, marks2 = Mark.none) {
    this.type = type;
    this.attrs = attrs2;
    this.marks = marks2;
    this.content = content || Fragment.empty;
  }
  /**
  The array of this node's child nodes.
  */
  get children() {
    return this.content.content;
  }
  /**
  The size of this node, as defined by the integer-based [indexing
  scheme](https://prosemirror.net/docs/guide/#doc.indexing). For text nodes, this is the
  amount of characters. For other leaf nodes, it is one. For
  non-leaf nodes, it is the size of the content plus two (the
  start and end token).
  */
  get nodeSize() {
    return this.isLeaf ? 1 : 2 + this.content.size;
  }
  /**
  The number of children that the node has.
  */
  get childCount() {
    return this.content.childCount;
  }
  /**
  Get the child node at the given index. Raises an error when the
  index is out of range.
  */
  child(index) {
    return this.content.child(index);
  }
  /**
  Get the child node at the given index, if it exists.
  */
  maybeChild(index) {
    return this.content.maybeChild(index);
  }
  /**
  Call `f` for every child node, passing the node, its offset
  into this parent node, and its index.
  */
  forEach(f) {
    this.content.forEach(f);
  }
  /**
  Invoke a callback for all descendant nodes recursively between
  the given two positions that are relative to start of this
  node's content. The callback is invoked with the node, its
  position relative to the original node (method receiver),
  its parent node, and its child index. When the callback returns
  false for a given node, that node's children will not be
  recursed over. The last parameter can be used to specify a
  starting position to count from.
  */
  nodesBetween(from, to, f, startPos = 0) {
    this.content.nodesBetween(from, to, f, startPos, this);
  }
  /**
  Call the given callback for every descendant node. Doesn't
  descend into a node when the callback returns `false`.
  */
  descendants(f) {
    this.nodesBetween(0, this.content.size, f);
  }
  /**
  Concatenates all the text nodes found in this fragment and its
  children.
  */
  get textContent() {
    return this.isLeaf && this.type.spec.leafText ? this.type.spec.leafText(this) : this.textBetween(0, this.content.size, "");
  }
  /**
  Get all text between positions `from` and `to`. When
  `blockSeparator` is given, it will be inserted to separate text
  from different block nodes. If `leafText` is given, it'll be
  inserted for every non-text leaf node encountered, otherwise
  [`leafText`](https://prosemirror.net/docs/ref/#model.NodeSpec.leafText) will be used.
  */
  textBetween(from, to, blockSeparator, leafText) {
    return this.content.textBetween(from, to, blockSeparator, leafText);
  }
  /**
  Returns this node's first child, or `null` if there are no
  children.
  */
  get firstChild() {
    return this.content.firstChild;
  }
  /**
  Returns this node's last child, or `null` if there are no
  children.
  */
  get lastChild() {
    return this.content.lastChild;
  }
  /**
  Test whether two nodes represent the same piece of document.
  */
  eq(other) {
    return this == other || this.sameMarkup(other) && this.content.eq(other.content);
  }
  /**
  Compare the markup (type, attributes, and marks) of this node to
  those of another. Returns `true` if both have the same markup.
  */
  sameMarkup(other) {
    return this.hasMarkup(other.type, other.attrs, other.marks);
  }
  /**
  Check whether this node's markup correspond to the given type,
  attributes, and marks.
  */
  hasMarkup(type, attrs2, marks2) {
    return this.type == type && compareDeep(this.attrs, attrs2 || type.defaultAttrs || emptyAttrs) && Mark.sameSet(this.marks, marks2 || Mark.none);
  }
  /**
  Create a new node with the same markup as this node, containing
  the given content (or empty, if no content is given).
  */
  copy(content = null) {
    if (content == this.content)
      return this;
    return new _Node(this.type, this.attrs, content, this.marks);
  }
  /**
  Create a copy of this node, with the given set of marks instead
  of the node's own marks.
  */
  mark(marks2) {
    return marks2 == this.marks ? this : new _Node(this.type, this.attrs, this.content, marks2);
  }
  /**
  Create a copy of this node with only the content between the
  given positions. If `to` is not given, it defaults to the end of
  the node.
  */
  cut(from, to = this.content.size) {
    if (from == 0 && to == this.content.size)
      return this;
    return this.copy(this.content.cut(from, to));
  }
  /**
  Cut out the part of the document between the given positions, and
  return it as a `Slice` object.
  */
  slice(from, to = this.content.size, includeParents = false) {
    if (from == to)
      return Slice.empty;
    let $from = this.resolve(from), $to = this.resolve(to);
    let depth = includeParents ? 0 : $from.sharedDepth(to);
    let start = $from.start(depth), node = $from.node(depth);
    let content = node.content.cut($from.pos - start, $to.pos - start);
    return new Slice(content, $from.depth - depth, $to.depth - depth);
  }
  /**
  Replace the part of the document between the given positions with
  the given slice. The slice must 'fit', meaning its open sides
  must be able to connect to the surrounding content, and its
  content nodes must be valid children for the node they are placed
  into. If any of this is violated, an error of type
  [`ReplaceError`](https://prosemirror.net/docs/ref/#model.ReplaceError) is thrown.
  */
  replace(from, to, slice) {
    return replace(this.resolve(from), this.resolve(to), slice);
  }
  /**
  Find the node directly after the given position.
  */
  nodeAt(pos) {
    for (let node = this; ; ) {
      let { index, offset } = node.content.findIndex(pos);
      node = node.maybeChild(index);
      if (!node)
        return null;
      if (offset == pos || node.isText)
        return node;
      pos -= offset + 1;
    }
  }
  /**
  Find the (direct) child node after the given offset, if any,
  and return it along with its index and offset relative to this
  node.
  */
  childAfter(pos) {
    let { index, offset } = this.content.findIndex(pos);
    return { node: this.content.maybeChild(index), index, offset };
  }
  /**
  Find the (direct) child node before the given offset, if any,
  and return it along with its index and offset relative to this
  node.
  */
  childBefore(pos) {
    if (pos == 0)
      return { node: null, index: 0, offset: 0 };
    let { index, offset } = this.content.findIndex(pos);
    if (offset < pos)
      return { node: this.content.child(index), index, offset };
    let node = this.content.child(index - 1);
    return { node, index: index - 1, offset: offset - node.nodeSize };
  }
  /**
  Resolve the given position in the document, returning an
  [object](https://prosemirror.net/docs/ref/#model.ResolvedPos) with information about its context.
  */
  resolve(pos) {
    return ResolvedPos.resolveCached(this, pos);
  }
  /**
  @internal
  */
  resolveNoCache(pos) {
    return ResolvedPos.resolve(this, pos);
  }
  /**
  Test whether a given mark or mark type occurs in this document
  between the two given positions.
  */
  rangeHasMark(from, to, type) {
    let found2 = false;
    if (to > from)
      this.nodesBetween(from, to, (node) => {
        if (type.isInSet(node.marks))
          found2 = true;
        return !found2;
      });
    return found2;
  }
  /**
  True when this is a block (non-inline node)
  */
  get isBlock() {
    return this.type.isBlock;
  }
  /**
  True when this is a textblock node, a block node with inline
  content.
  */
  get isTextblock() {
    return this.type.isTextblock;
  }
  /**
  True when this node allows inline content.
  */
  get inlineContent() {
    return this.type.inlineContent;
  }
  /**
  True when this is an inline node (a text node or a node that can
  appear among text).
  */
  get isInline() {
    return this.type.isInline;
  }
  /**
  True when this is a text node.
  */
  get isText() {
    return this.type.isText;
  }
  /**
  True when this is a leaf node.
  */
  get isLeaf() {
    return this.type.isLeaf;
  }
  /**
  True when this is an atom, i.e. when it does not have directly
  editable content. This is usually the same as `isLeaf`, but can
  be configured with the [`atom` property](https://prosemirror.net/docs/ref/#model.NodeSpec.atom)
  on a node's spec (typically used when the node is displayed as
  an uneditable [node view](https://prosemirror.net/docs/ref/#view.NodeView)).
  */
  get isAtom() {
    return this.type.isAtom;
  }
  /**
  Return a string representation of this node for debugging
  purposes.
  */
  toString() {
    if (this.type.spec.toDebugString)
      return this.type.spec.toDebugString(this);
    let name = this.type.name;
    if (this.content.size)
      name += "(" + this.content.toStringInner() + ")";
    return wrapMarks(this.marks, name);
  }
  /**
  Get the content match in this node at the given index.
  */
  contentMatchAt(index) {
    let match = this.type.contentMatch.matchFragment(this.content, 0, index);
    if (!match)
      throw new Error("Called contentMatchAt on a node with invalid content");
    return match;
  }
  /**
  Test whether replacing the range between `from` and `to` (by
  child index) with the given replacement fragment (which defaults
  to the empty fragment) would leave the node's content valid. You
  can optionally pass `start` and `end` indices into the
  replacement fragment.
  */
  canReplace(from, to, replacement = Fragment.empty, start = 0, end = replacement.childCount) {
    let one = this.contentMatchAt(from).matchFragment(replacement, start, end);
    let two = one && one.matchFragment(this.content, to);
    if (!two || !two.validEnd)
      return false;
    for (let i = start; i < end; i++)
      if (!this.type.allowsMarks(replacement.child(i).marks))
        return false;
    return true;
  }
  /**
  Test whether replacing the range `from` to `to` (by index) with
  a node of the given type would leave the node's content valid.
  */
  canReplaceWith(from, to, type, marks2) {
    if (marks2 && !this.type.allowsMarks(marks2))
      return false;
    let start = this.contentMatchAt(from).matchType(type);
    let end = start && start.matchFragment(this.content, to);
    return end ? end.validEnd : false;
  }
  /**
  Test whether the given node's content could be appended to this
  node. If that node is empty, this will only return true if there
  is at least one node type that can appear in both nodes (to avoid
  merging completely incompatible nodes).
  */
  canAppend(other) {
    if (other.content.size)
      return this.canReplace(this.childCount, this.childCount, other.content);
    else
      return this.type.compatibleContent(other.type);
  }
  /**
  Check whether this node and its descendants conform to the
  schema, and raise an exception when they do not.
  */
  check() {
    this.type.checkContent(this.content);
    this.type.checkAttrs(this.attrs);
    let copy = Mark.none;
    for (let i = 0; i < this.marks.length; i++) {
      let mark = this.marks[i];
      mark.type.checkAttrs(mark.attrs);
      copy = mark.addToSet(copy);
    }
    if (!Mark.sameSet(copy, this.marks))
      throw new RangeError(`Invalid collection of marks for node ${this.type.name}: ${this.marks.map((m) => m.type.name)}`);
    this.content.forEach((node) => node.check());
  }
  /**
  Return a JSON-serializeable representation of this node.
  */
  toJSON() {
    let obj = { type: this.type.name };
    for (let _ in this.attrs) {
      obj.attrs = this.attrs;
      break;
    }
    if (this.content.size)
      obj.content = this.content.toJSON();
    if (this.marks.length)
      obj.marks = this.marks.map((n) => n.toJSON());
    return obj;
  }
  /**
  Deserialize a node from its JSON representation.
  */
  static fromJSON(schema2, json) {
    if (!json)
      throw new RangeError("Invalid input for Node.fromJSON");
    let marks2 = void 0;
    if (json.marks) {
      if (!Array.isArray(json.marks))
        throw new RangeError("Invalid mark data for Node.fromJSON");
      marks2 = json.marks.map(schema2.markFromJSON);
    }
    if (json.type == "text") {
      if (typeof json.text != "string")
        throw new RangeError("Invalid text node in JSON");
      return schema2.text(json.text, marks2);
    }
    let content = Fragment.fromJSON(schema2, json.content);
    let node = schema2.nodeType(json.type).create(json.attrs, content, marks2);
    node.type.checkAttrs(node.attrs);
    return node;
  }
};
Node.prototype.text = void 0;
var TextNode = class _TextNode extends Node {
  /**
  @internal
  */
  constructor(type, attrs2, content, marks2) {
    super(type, attrs2, null, marks2);
    if (!content)
      throw new RangeError("Empty text nodes are not allowed");
    this.text = content;
  }
  toString() {
    if (this.type.spec.toDebugString)
      return this.type.spec.toDebugString(this);
    return wrapMarks(this.marks, JSON.stringify(this.text));
  }
  get textContent() {
    return this.text;
  }
  textBetween(from, to) {
    return this.text.slice(from, to);
  }
  get nodeSize() {
    return this.text.length;
  }
  mark(marks2) {
    return marks2 == this.marks ? this : new _TextNode(this.type, this.attrs, this.text, marks2);
  }
  withText(text) {
    if (text == this.text)
      return this;
    return new _TextNode(this.type, this.attrs, text, this.marks);
  }
  cut(from = 0, to = this.text.length) {
    if (from == 0 && to == this.text.length)
      return this;
    return this.withText(this.text.slice(from, to));
  }
  eq(other) {
    return this.sameMarkup(other) && this.text == other.text;
  }
  toJSON() {
    let base2 = super.toJSON();
    base2.text = this.text;
    return base2;
  }
};
function wrapMarks(marks2, str) {
  for (let i = marks2.length - 1; i >= 0; i--)
    str = marks2[i].type.name + "(" + str + ")";
  return str;
}
var ContentMatch = class _ContentMatch {
  /**
  @internal
  */
  constructor(validEnd) {
    this.validEnd = validEnd;
    this.next = [];
    this.wrapCache = [];
  }
  /**
  @internal
  */
  static parse(string, nodeTypes) {
    let stream = new TokenStream(string, nodeTypes);
    if (stream.next == null)
      return _ContentMatch.empty;
    let expr = parseExpr(stream);
    if (stream.next)
      stream.err("Unexpected trailing text");
    let match = dfa(nfa(expr));
    checkForDeadEnds(match, stream);
    return match;
  }
  /**
  Match a node type, returning a match after that node if
  successful.
  */
  matchType(type) {
    for (let i = 0; i < this.next.length; i++)
      if (this.next[i].type == type)
        return this.next[i].next;
    return null;
  }
  /**
  Try to match a fragment. Returns the resulting match when
  successful.
  */
  matchFragment(frag, start = 0, end = frag.childCount) {
    let cur = this;
    for (let i = start; cur && i < end; i++)
      cur = cur.matchType(frag.child(i).type);
    return cur;
  }
  /**
  @internal
  */
  get inlineContent() {
    return this.next.length != 0 && this.next[0].type.isInline;
  }
  /**
  Get the first matching node type at this match position that can
  be generated.
  */
  get defaultType() {
    for (let i = 0; i < this.next.length; i++) {
      let { type } = this.next[i];
      if (!(type.isText || type.hasRequiredAttrs()))
        return type;
    }
    return null;
  }
  /**
  @internal
  */
  compatible(other) {
    for (let i = 0; i < this.next.length; i++)
      for (let j = 0; j < other.next.length; j++)
        if (this.next[i].type == other.next[j].type)
          return true;
    return false;
  }
  /**
  Try to match the given fragment, and if that fails, see if it can
  be made to match by inserting nodes in front of it. When
  successful, return a fragment of inserted nodes (which may be
  empty if nothing had to be inserted). When `toEnd` is true, only
  return a fragment if the resulting match goes to the end of the
  content expression.
  */
  fillBefore(after, toEnd = false, startIndex = 0) {
    let seen = [this];
    function search(match, types) {
      let finished = match.matchFragment(after, startIndex);
      if (finished && (!toEnd || finished.validEnd))
        return Fragment.from(types.map((tp) => tp.createAndFill()));
      for (let i = 0; i < match.next.length; i++) {
        let { type, next } = match.next[i];
        if (!(type.isText || type.hasRequiredAttrs()) && seen.indexOf(next) == -1) {
          seen.push(next);
          let found2 = search(next, types.concat(type));
          if (found2)
            return found2;
        }
      }
      return null;
    }
    return search(this, []);
  }
  /**
  Find a set of wrapping node types that would allow a node of the
  given type to appear at this position. The result may be empty
  (when it fits directly) and will be null when no such wrapping
  exists.
  */
  findWrapping(target) {
    for (let i = 0; i < this.wrapCache.length; i += 2)
      if (this.wrapCache[i] == target)
        return this.wrapCache[i + 1];
    let computed = this.computeWrapping(target);
    this.wrapCache.push(target, computed);
    return computed;
  }
  /**
  @internal
  */
  computeWrapping(target) {
    let seen = /* @__PURE__ */ Object.create(null), active = [{ match: this, type: null, via: null }];
    while (active.length) {
      let current = active.shift(), match = current.match;
      if (match.matchType(target)) {
        let result = [];
        for (let obj = current; obj.type; obj = obj.via)
          result.push(obj.type);
        return result.reverse();
      }
      for (let i = 0; i < match.next.length; i++) {
        let { type, next } = match.next[i];
        if (!type.isLeaf && !type.hasRequiredAttrs() && !(type.name in seen) && (!current.type || next.validEnd)) {
          active.push({ match: type.contentMatch, type, via: current });
          seen[type.name] = true;
        }
      }
    }
    return null;
  }
  /**
  The number of outgoing edges this node has in the finite
  automaton that describes the content expression.
  */
  get edgeCount() {
    return this.next.length;
  }
  /**
  Get the _n_​th outgoing edge from this node in the finite
  automaton that describes the content expression.
  */
  edge(n) {
    if (n >= this.next.length)
      throw new RangeError(`There's no ${n}th edge in this content match`);
    return this.next[n];
  }
  /**
  @internal
  */
  toString() {
    let seen = [];
    function scan(m) {
      seen.push(m);
      for (let i = 0; i < m.next.length; i++)
        if (seen.indexOf(m.next[i].next) == -1)
          scan(m.next[i].next);
    }
    scan(this);
    return seen.map((m, i) => {
      let out = i + (m.validEnd ? "*" : " ") + " ";
      for (let i2 = 0; i2 < m.next.length; i2++)
        out += (i2 ? ", " : "") + m.next[i2].type.name + "->" + seen.indexOf(m.next[i2].next);
      return out;
    }).join("\n");
  }
};
ContentMatch.empty = new ContentMatch(true);
var TokenStream = class {
  constructor(string, nodeTypes) {
    this.string = string;
    this.nodeTypes = nodeTypes;
    this.inline = null;
    this.pos = 0;
    this.tokens = string.split(/\s*(?=\b|\W|$)/);
    if (this.tokens[this.tokens.length - 1] == "")
      this.tokens.pop();
    if (this.tokens[0] == "")
      this.tokens.shift();
  }
  get next() {
    return this.tokens[this.pos];
  }
  eat(tok) {
    return this.next == tok && (this.pos++ || true);
  }
  err(str) {
    throw new SyntaxError(str + " (in content expression '" + this.string + "')");
  }
};
function parseExpr(stream) {
  let exprs = [];
  do {
    exprs.push(parseExprSeq(stream));
  } while (stream.eat("|"));
  return exprs.length == 1 ? exprs[0] : { type: "choice", exprs };
}
function parseExprSeq(stream) {
  let exprs = [];
  do {
    exprs.push(parseExprSubscript(stream));
  } while (stream.next && stream.next != ")" && stream.next != "|");
  return exprs.length == 1 ? exprs[0] : { type: "seq", exprs };
}
function parseExprSubscript(stream) {
  let expr = parseExprAtom(stream);
  for (; ; ) {
    if (stream.eat("+"))
      expr = { type: "plus", expr };
    else if (stream.eat("*"))
      expr = { type: "star", expr };
    else if (stream.eat("?"))
      expr = { type: "opt", expr };
    else if (stream.eat("{"))
      expr = parseExprRange(stream, expr);
    else
      break;
  }
  return expr;
}
function parseNum(stream) {
  if (/\D/.test(stream.next))
    stream.err("Expected number, got '" + stream.next + "'");
  let result = Number(stream.next);
  stream.pos++;
  return result;
}
function parseExprRange(stream, expr) {
  let min = parseNum(stream), max2 = min;
  if (stream.eat(",")) {
    if (stream.next != "}")
      max2 = parseNum(stream);
    else
      max2 = -1;
  }
  if (!stream.eat("}"))
    stream.err("Unclosed braced range");
  return { type: "range", min, max: max2, expr };
}
function resolveName(stream, name) {
  let types = stream.nodeTypes, type = types[name];
  if (type)
    return [type];
  let result = [];
  for (let typeName in types) {
    let type2 = types[typeName];
    if (type2.isInGroup(name))
      result.push(type2);
  }
  if (result.length == 0)
    stream.err("No node type or group '" + name + "' found");
  return result;
}
function parseExprAtom(stream) {
  if (stream.eat("(")) {
    let expr = parseExpr(stream);
    if (!stream.eat(")"))
      stream.err("Missing closing paren");
    return expr;
  } else if (!/\W/.test(stream.next)) {
    let exprs = resolveName(stream, stream.next).map((type) => {
      if (stream.inline == null)
        stream.inline = type.isInline;
      else if (stream.inline != type.isInline)
        stream.err("Mixing inline and block content");
      return { type: "name", value: type };
    });
    stream.pos++;
    return exprs.length == 1 ? exprs[0] : { type: "choice", exprs };
  } else {
    stream.err("Unexpected token '" + stream.next + "'");
  }
}
function nfa(expr) {
  let nfa2 = [[]];
  connect(compile(expr, 0), node());
  return nfa2;
  function node() {
    return nfa2.push([]) - 1;
  }
  function edge(from, to, term) {
    let edge2 = { term, to };
    nfa2[from].push(edge2);
    return edge2;
  }
  function connect(edges, to) {
    edges.forEach((edge2) => edge2.to = to);
  }
  function compile(expr2, from) {
    if (expr2.type == "choice") {
      return expr2.exprs.reduce((out, expr3) => out.concat(compile(expr3, from)), []);
    } else if (expr2.type == "seq") {
      for (let i = 0; ; i++) {
        let next = compile(expr2.exprs[i], from);
        if (i == expr2.exprs.length - 1)
          return next;
        connect(next, from = node());
      }
    } else if (expr2.type == "star") {
      let loop = node();
      edge(from, loop);
      connect(compile(expr2.expr, loop), loop);
      return [edge(loop)];
    } else if (expr2.type == "plus") {
      let loop = node();
      connect(compile(expr2.expr, from), loop);
      connect(compile(expr2.expr, loop), loop);
      return [edge(loop)];
    } else if (expr2.type == "opt") {
      return [edge(from)].concat(compile(expr2.expr, from));
    } else if (expr2.type == "range") {
      let cur = from;
      for (let i = 0; i < expr2.min; i++) {
        let next = node();
        connect(compile(expr2.expr, cur), next);
        cur = next;
      }
      if (expr2.max == -1) {
        connect(compile(expr2.expr, cur), cur);
      } else {
        for (let i = expr2.min; i < expr2.max; i++) {
          let next = node();
          edge(cur, next);
          connect(compile(expr2.expr, cur), next);
          cur = next;
        }
      }
      return [edge(cur)];
    } else if (expr2.type == "name") {
      return [edge(from, void 0, expr2.value)];
    } else {
      throw new Error("Unknown expr type");
    }
  }
}
function cmp(a, b) {
  return b - a;
}
function nullFrom(nfa2, node) {
  let result = [];
  scan(node);
  return result.sort(cmp);
  function scan(node2) {
    let edges = nfa2[node2];
    if (edges.length == 1 && !edges[0].term)
      return scan(edges[0].to);
    result.push(node2);
    for (let i = 0; i < edges.length; i++) {
      let { term, to } = edges[i];
      if (!term && result.indexOf(to) == -1)
        scan(to);
    }
  }
}
function dfa(nfa2) {
  let labeled = /* @__PURE__ */ Object.create(null);
  return explore(nullFrom(nfa2, 0));
  function explore(states) {
    let out = [];
    states.forEach((node) => {
      nfa2[node].forEach(({ term, to }) => {
        if (!term)
          return;
        let set;
        for (let i = 0; i < out.length; i++)
          if (out[i][0] == term)
            set = out[i][1];
        nullFrom(nfa2, to).forEach((node2) => {
          if (!set)
            out.push([term, set = []]);
          if (set.indexOf(node2) == -1)
            set.push(node2);
        });
      });
    });
    let state = labeled[states.join(",")] = new ContentMatch(states.indexOf(nfa2.length - 1) > -1);
    for (let i = 0; i < out.length; i++) {
      let states2 = out[i][1].sort(cmp);
      state.next.push({ type: out[i][0], next: labeled[states2.join(",")] || explore(states2) });
    }
    return state;
  }
}
function checkForDeadEnds(match, stream) {
  for (let i = 0, work = [match]; i < work.length; i++) {
    let state = work[i], dead = !state.validEnd, nodes2 = [];
    for (let j = 0; j < state.next.length; j++) {
      let { type, next } = state.next[j];
      nodes2.push(type.name);
      if (dead && !(type.isText || type.hasRequiredAttrs()))
        dead = false;
      if (work.indexOf(next) == -1)
        work.push(next);
    }
    if (dead)
      stream.err("Only non-generatable nodes (" + nodes2.join(", ") + ") in a required position (see https://prosemirror.net/docs/guide/#generatable)");
  }
}
function defaultAttrs(attrs2) {
  let defaults = /* @__PURE__ */ Object.create(null);
  for (let attrName in attrs2) {
    let attr = attrs2[attrName];
    if (!attr.hasDefault)
      return null;
    defaults[attrName] = attr.default;
  }
  return defaults;
}
function computeAttrs(attrs2, value) {
  let built = /* @__PURE__ */ Object.create(null);
  for (let name in attrs2) {
    let given = value && value[name];
    if (given === void 0) {
      let attr = attrs2[name];
      if (attr.hasDefault)
        given = attr.default;
      else
        throw new RangeError("No value supplied for attribute " + name);
    }
    built[name] = given;
  }
  return built;
}
function checkAttrs(attrs2, values, type, name) {
  for (let name2 in values)
    if (!(name2 in attrs2))
      throw new RangeError(`Unsupported attribute ${name2} for ${type} of type ${name2}`);
  for (let name2 in attrs2) {
    let attr = attrs2[name2];
    if (attr.validate)
      attr.validate(values[name2]);
  }
}
function initAttrs(typeName, attrs2) {
  let result = /* @__PURE__ */ Object.create(null);
  if (attrs2)
    for (let name in attrs2)
      result[name] = new Attribute(typeName, name, attrs2[name]);
  return result;
}
var NodeType = class _NodeType {
  /**
  @internal
  */
  constructor(name, schema2, spec) {
    this.name = name;
    this.schema = schema2;
    this.spec = spec;
    this.markSet = null;
    this.groups = spec.group ? spec.group.split(" ") : [];
    this.attrs = initAttrs(name, spec.attrs);
    this.defaultAttrs = defaultAttrs(this.attrs);
    this.contentMatch = null;
    this.inlineContent = null;
    this.isBlock = !(spec.inline || name == "text");
    this.isText = name == "text";
  }
  /**
  True if this is an inline type.
  */
  get isInline() {
    return !this.isBlock;
  }
  /**
  True if this is a textblock type, a block that contains inline
  content.
  */
  get isTextblock() {
    return this.isBlock && this.inlineContent;
  }
  /**
  True for node types that allow no content.
  */
  get isLeaf() {
    return this.contentMatch == ContentMatch.empty;
  }
  /**
  True when this node is an atom, i.e. when it does not have
  directly editable content.
  */
  get isAtom() {
    return this.isLeaf || !!this.spec.atom;
  }
  /**
  Return true when this node type is part of the given
  [group](https://prosemirror.net/docs/ref/#model.NodeSpec.group).
  */
  isInGroup(group) {
    return this.groups.indexOf(group) > -1;
  }
  /**
  The node type's [whitespace](https://prosemirror.net/docs/ref/#model.NodeSpec.whitespace) option.
  */
  get whitespace() {
    return this.spec.whitespace || (this.spec.code ? "pre" : "normal");
  }
  /**
  Tells you whether this node type has any required attributes.
  */
  hasRequiredAttrs() {
    for (let n in this.attrs)
      if (this.attrs[n].isRequired)
        return true;
    return false;
  }
  /**
  Indicates whether this node allows some of the same content as
  the given node type.
  */
  compatibleContent(other) {
    return this == other || this.contentMatch.compatible(other.contentMatch);
  }
  /**
  @internal
  */
  computeAttrs(attrs2) {
    if (!attrs2 && this.defaultAttrs)
      return this.defaultAttrs;
    else
      return computeAttrs(this.attrs, attrs2);
  }
  /**
  Create a `Node` of this type. The given attributes are
  checked and defaulted (you can pass `null` to use the type's
  defaults entirely, if no required attributes exist). `content`
  may be a `Fragment`, a node, an array of nodes, or
  `null`. Similarly `marks` may be `null` to default to the empty
  set of marks.
  */
  create(attrs2 = null, content, marks2) {
    if (this.isText)
      throw new Error("NodeType.create can't construct text nodes");
    return new Node(this, this.computeAttrs(attrs2), Fragment.from(content), Mark.setFrom(marks2));
  }
  /**
  Like [`create`](https://prosemirror.net/docs/ref/#model.NodeType.create), but check the given content
  against the node type's content restrictions, and throw an error
  if it doesn't match.
  */
  createChecked(attrs2 = null, content, marks2) {
    content = Fragment.from(content);
    this.checkContent(content);
    return new Node(this, this.computeAttrs(attrs2), content, Mark.setFrom(marks2));
  }
  /**
  Like [`create`](https://prosemirror.net/docs/ref/#model.NodeType.create), but see if it is
  necessary to add nodes to the start or end of the given fragment
  to make it fit the node. If no fitting wrapping can be found,
  return null. Note that, due to the fact that required nodes can
  always be created, this will always succeed if you pass null or
  `Fragment.empty` as content.
  */
  createAndFill(attrs2 = null, content, marks2) {
    attrs2 = this.computeAttrs(attrs2);
    content = Fragment.from(content);
    if (content.size) {
      let before = this.contentMatch.fillBefore(content);
      if (!before)
        return null;
      content = before.append(content);
    }
    let matched = this.contentMatch.matchFragment(content);
    let after = matched && matched.fillBefore(Fragment.empty, true);
    if (!after)
      return null;
    return new Node(this, attrs2, content.append(after), Mark.setFrom(marks2));
  }
  /**
  Returns true if the given fragment is valid content for this node
  type.
  */
  validContent(content) {
    let result = this.contentMatch.matchFragment(content);
    if (!result || !result.validEnd)
      return false;
    for (let i = 0; i < content.childCount; i++)
      if (!this.allowsMarks(content.child(i).marks))
        return false;
    return true;
  }
  /**
  Throws a RangeError if the given fragment is not valid content for this
  node type.
  @internal
  */
  checkContent(content) {
    if (!this.validContent(content))
      throw new RangeError(`Invalid content for node ${this.name}: ${content.toString().slice(0, 50)}`);
  }
  /**
  @internal
  */
  checkAttrs(attrs2) {
    checkAttrs(this.attrs, attrs2, "node", this.name);
  }
  /**
  Check whether the given mark type is allowed in this node.
  */
  allowsMarkType(markType) {
    return this.markSet == null || this.markSet.indexOf(markType) > -1;
  }
  /**
  Test whether the given set of marks are allowed in this node.
  */
  allowsMarks(marks2) {
    if (this.markSet == null)
      return true;
    for (let i = 0; i < marks2.length; i++)
      if (!this.allowsMarkType(marks2[i].type))
        return false;
    return true;
  }
  /**
  Removes the marks that are not allowed in this node from the given set.
  */
  allowedMarks(marks2) {
    if (this.markSet == null)
      return marks2;
    let copy;
    for (let i = 0; i < marks2.length; i++) {
      if (!this.allowsMarkType(marks2[i].type)) {
        if (!copy)
          copy = marks2.slice(0, i);
      } else if (copy) {
        copy.push(marks2[i]);
      }
    }
    return !copy ? marks2 : copy.length ? copy : Mark.none;
  }
  /**
  @internal
  */
  static compile(nodes2, schema2) {
    let result = /* @__PURE__ */ Object.create(null);
    nodes2.forEach((name, spec) => result[name] = new _NodeType(name, schema2, spec));
    let topType = schema2.spec.topNode || "doc";
    if (!result[topType])
      throw new RangeError("Schema is missing its top node type ('" + topType + "')");
    if (!result.text)
      throw new RangeError("Every schema needs a 'text' type");
    for (let _ in result.text.attrs)
      throw new RangeError("The text node type should not have attributes");
    return result;
  }
};
function validateType(typeName, attrName, type) {
  let types = type.split("|");
  return (value) => {
    let name = value === null ? "null" : typeof value;
    if (types.indexOf(name) < 0)
      throw new RangeError(`Expected value of type ${types} for attribute ${attrName} on type ${typeName}, got ${name}`);
  };
}
var Attribute = class {
  constructor(typeName, attrName, options) {
    this.hasDefault = Object.prototype.hasOwnProperty.call(options, "default");
    this.default = options.default;
    this.validate = typeof options.validate == "string" ? validateType(typeName, attrName, options.validate) : options.validate;
  }
  get isRequired() {
    return !this.hasDefault;
  }
};
var MarkType = class _MarkType {
  /**
  @internal
  */
  constructor(name, rank, schema2, spec) {
    this.name = name;
    this.rank = rank;
    this.schema = schema2;
    this.spec = spec;
    this.attrs = initAttrs(name, spec.attrs);
    this.excluded = null;
    let defaults = defaultAttrs(this.attrs);
    this.instance = defaults ? new Mark(this, defaults) : null;
  }
  /**
  Create a mark of this type. `attrs` may be `null` or an object
  containing only some of the mark's attributes. The others, if
  they have defaults, will be added.
  */
  create(attrs2 = null) {
    if (!attrs2 && this.instance)
      return this.instance;
    return new Mark(this, computeAttrs(this.attrs, attrs2));
  }
  /**
  @internal
  */
  static compile(marks2, schema2) {
    let result = /* @__PURE__ */ Object.create(null), rank = 0;
    marks2.forEach((name, spec) => result[name] = new _MarkType(name, rank++, schema2, spec));
    return result;
  }
  /**
  When there is a mark of this type in the given set, a new set
  without it is returned. Otherwise, the input set is returned.
  */
  removeFromSet(set) {
    for (var i = 0; i < set.length; i++)
      if (set[i].type == this) {
        set = set.slice(0, i).concat(set.slice(i + 1));
        i--;
      }
    return set;
  }
  /**
  Tests whether there is a mark of this type in the given set.
  */
  isInSet(set) {
    for (let i = 0; i < set.length; i++)
      if (set[i].type == this)
        return set[i];
  }
  /**
  @internal
  */
  checkAttrs(attrs2) {
    checkAttrs(this.attrs, attrs2, "mark", this.name);
  }
  /**
  Queries whether a given mark type is
  [excluded](https://prosemirror.net/docs/ref/#model.MarkSpec.excludes) by this one.
  */
  excludes(other) {
    return this.excluded.indexOf(other) > -1;
  }
};
var Schema = class {
  /**
  Construct a schema from a schema [specification](https://prosemirror.net/docs/ref/#model.SchemaSpec).
  */
  constructor(spec) {
    this.linebreakReplacement = null;
    this.cached = /* @__PURE__ */ Object.create(null);
    let instanceSpec = this.spec = {};
    for (let prop in spec)
      instanceSpec[prop] = spec[prop];
    instanceSpec.nodes = dist_default.from(spec.nodes), instanceSpec.marks = dist_default.from(spec.marks || {}), this.nodes = NodeType.compile(this.spec.nodes, this);
    this.marks = MarkType.compile(this.spec.marks, this);
    let contentExprCache = /* @__PURE__ */ Object.create(null);
    for (let prop in this.nodes) {
      if (prop in this.marks)
        throw new RangeError(prop + " can not be both a node and a mark");
      let type = this.nodes[prop], contentExpr = type.spec.content || "", markExpr = type.spec.marks;
      type.contentMatch = contentExprCache[contentExpr] || (contentExprCache[contentExpr] = ContentMatch.parse(contentExpr, this.nodes));
      type.inlineContent = type.contentMatch.inlineContent;
      if (type.spec.linebreakReplacement) {
        if (this.linebreakReplacement)
          throw new RangeError("Multiple linebreak nodes defined");
        if (!type.isInline || !type.isLeaf)
          throw new RangeError("Linebreak replacement nodes must be inline leaf nodes");
        this.linebreakReplacement = type;
      }
      type.markSet = markExpr == "_" ? null : markExpr ? gatherMarks(this, markExpr.split(" ")) : markExpr == "" || !type.inlineContent ? [] : null;
    }
    for (let prop in this.marks) {
      let type = this.marks[prop], excl = type.spec.excludes;
      type.excluded = excl == null ? [type] : excl == "" ? [] : gatherMarks(this, excl.split(" "));
    }
    this.nodeFromJSON = (json) => Node.fromJSON(this, json);
    this.markFromJSON = (json) => Mark.fromJSON(this, json);
    this.topNodeType = this.nodes[this.spec.topNode || "doc"];
    this.cached.wrappings = /* @__PURE__ */ Object.create(null);
  }
  /**
  Create a node in this schema. The `type` may be a string or a
  `NodeType` instance. Attributes will be extended with defaults,
  `content` may be a `Fragment`, `null`, a `Node`, or an array of
  nodes.
  */
  node(type, attrs2 = null, content, marks2) {
    if (typeof type == "string")
      type = this.nodeType(type);
    else if (!(type instanceof NodeType))
      throw new RangeError("Invalid node type: " + type);
    else if (type.schema != this)
      throw new RangeError("Node type from different schema used (" + type.name + ")");
    return type.createChecked(attrs2, content, marks2);
  }
  /**
  Create a text node in the schema. Empty text nodes are not
  allowed.
  */
  text(text, marks2) {
    let type = this.nodes.text;
    return new TextNode(type, type.defaultAttrs, text, Mark.setFrom(marks2));
  }
  /**
  Create a mark with the given type and attributes.
  */
  mark(type, attrs2) {
    if (typeof type == "string")
      type = this.marks[type];
    return type.create(attrs2);
  }
  /**
  @internal
  */
  nodeType(name) {
    let found2 = this.nodes[name];
    if (!found2)
      throw new RangeError("Unknown node type: " + name);
    return found2;
  }
};
function gatherMarks(schema2, marks2) {
  let found2 = [];
  for (let i = 0; i < marks2.length; i++) {
    let name = marks2[i], mark = schema2.marks[name], ok2 = mark;
    if (mark) {
      found2.push(mark);
    } else {
      for (let prop in schema2.marks) {
        let mark2 = schema2.marks[prop];
        if (name == "_" || mark2.spec.group && mark2.spec.group.split(" ").indexOf(name) > -1)
          found2.push(ok2 = mark2);
      }
    }
    if (!ok2)
      throw new SyntaxError("Unknown mark type: '" + marks2[i] + "'");
  }
  return found2;
}

// src/schema/ids.ts
var HEADING_BOOKMARK_PREFIX = "pmd-heading-";
var HEADING_TYPE_NAMES = /* @__PURE__ */ new Set([
  "pocket",
  "hat",
  "block",
  "tag",
  "analytic"
]);
function newHeadingId() {
  return crypto.randomUUID();
}
function stampMissingHeadingIds(doc) {
  return walk(doc);
}
function walk(node) {
  if (node.isText) return node;
  let inner = node.content;
  if (!node.isLeaf) {
    const newChildren = [];
    let changed = false;
    node.forEach((child) => {
      const next = walk(child);
      if (next !== child) changed = true;
      newChildren.push(next);
    });
    if (changed) {
      inner = node.type.create(node.attrs, newChildren, node.marks).content;
    }
  }
  const needsStamp = HEADING_TYPE_NAMES.has(node.type.name) && node.attrs["id"] == null;
  if (!needsStamp) {
    return inner === node.content ? node : node.type.create(node.attrs, inner, node.marks);
  }
  return node.type.create(
    { ...node.attrs, id: newHeadingId() },
    inner,
    node.marks
  );
}
function idFromBookmarkName(name) {
  return name.startsWith(HEADING_BOOKMARK_PREFIX) ? name.slice(HEADING_BOOKMARK_PREFIX.length) : null;
}

// src/schema/nodes.ts
var indentAttr = {
  indent: {
    default: 0,
    validate: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0
  }
};
var spacingAttr = {
  spacing: {
    default: null,
    validate: (v) => v === null || typeof v === "object" && v !== null && !Array.isArray(v)
  }
};
var headingAttrs = {
  id: {
    default: null,
    validate: (v) => v === null || typeof v === "string"
  },
  ...indentAttr,
  ...spacingAttr
};
var numberingCardAttrs = {
  numRole: {
    default: "none",
    validate: (v) => v === "none" || v === "number" || v === "sub"
  },
  numRestart: {
    default: false,
    validate: (v) => typeof v === "boolean"
  }
};
var blockAttrs = {
  ...headingAttrs,
  numRestart: {
    default: true,
    validate: (v) => typeof v === "boolean"
  }
};
function indentToStyle(indent) {
  const n = Number(indent ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `padding-left: ${n / 15}px`;
}
function readIndentFromStyle(dom) {
  const v = dom.style.paddingLeft;
  if (!v) return 0;
  const m = v.match(/^(\d+(?:\.\d+)?)px$/);
  if (!m) return 0;
  return Math.max(0, Math.round(parseFloat(m[1]) * 15));
}
function intrinsicHeightStyle(node) {
  const chars = node.textContent.length;
  const paras = node.childCount;
  const est = Math.max(40, Math.round(chars / 95 * 21 + paras * 8 + 24));
  return `contain-intrinsic-height: auto ${est}px`;
}
var BLOCK_CONTENT = "(paragraph | pocket | hat | block | card | analytic_unit | undertag | cite_paragraph | card_body | table | transclusion_ref | self_ref)*";
var nodes = {
  /** Top-level container. Sequence of block-level content. */
  doc: { content: BLOCK_CONTENT },
  /** A run of inline content. Plain text + marks. */
  text: { group: "inline" },
  /**
   * Inline image. Round-trips to OOXML `<w:drawing><wp:inline>...`.
   *
   * The image bytes are stored as base64 in the `data` attr so the doc
   * is self-contained and survives JSON round-trips through localStorage,
   * collaboration sync, undo/redo, etc. without a separate manifest.
   * `widthEmu` / `heightEmu` carry the original OOXML dimensions in
   * English Metric Units (914400 EMU per inch); rendering converts to
   * pixels at 96dpi.
   *
   * Atomic + draggable: ProseMirror treats the image as an indivisible
   * inline glyph — cursor goes around it, not into it. `draggable` is
   * currently inert: the editor swallows all `dragstart` events (see
   * the text-drag-suppression plugin in `editor/index.ts`), so image
   * drag-and-drop needs a carve-out there before it works.
   */
  image: {
    inline: true,
    group: "inline",
    atom: true,
    draggable: true,
    attrs: {
      data: {
        default: "",
        validate: (v) => typeof v === "string"
      },
      contentType: {
        default: "image/png",
        validate: (v) => typeof v === "string" && /^image\//.test(v)
      },
      widthEmu: {
        default: 0,
        validate: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0
      },
      heightEmu: {
        default: 0,
        validate: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0
      },
      alt: {
        default: "",
        validate: (v) => typeof v === "string"
      }
    },
    parseDOM: [
      {
        tag: "img[data-pmd-image]",
        getAttrs: (dom) => {
          const src = dom.getAttribute("src") ?? "";
          const m = src.match(/^data:([^;]+);base64,(.+)$/);
          if (!m) return false;
          const widthEmu = parseInt(dom.getAttribute("data-width-emu") ?? "0", 10);
          const heightEmu = parseInt(dom.getAttribute("data-height-emu") ?? "0", 10);
          return {
            data: m[2],
            contentType: m[1],
            widthEmu: Number.isFinite(widthEmu) ? widthEmu : 0,
            heightEmu: Number.isFinite(heightEmu) ? heightEmu : 0,
            alt: dom.getAttribute("alt") ?? ""
          };
        }
      },
      {
        // Placeholder span — for non-browser-renderable formats (EMF /
        // WMF / TIFF). Carries the same data attributes so re-saving
        // through DOM round-trip works.
        tag: "span[data-pmd-image]",
        getAttrs: (dom) => {
          const data = dom.getAttribute("data-image-data") ?? "";
          const contentType = dom.getAttribute("data-content-type") ?? "application/octet-stream";
          const widthEmu = parseInt(dom.getAttribute("data-width-emu") ?? "0", 10);
          const heightEmu = parseInt(dom.getAttribute("data-height-emu") ?? "0", 10);
          return {
            data,
            contentType,
            widthEmu: Number.isFinite(widthEmu) ? widthEmu : 0,
            heightEmu: Number.isFinite(heightEmu) ? heightEmu : 0,
            alt: dom.getAttribute("data-alt") ?? ""
          };
        }
      }
    ],
    toDOM: (node) => {
      const data = String(node.attrs["data"] ?? "");
      const contentType = String(node.attrs["contentType"] ?? "image/png");
      const widthEmu = Number(node.attrs["widthEmu"] ?? 0);
      const heightEmu = Number(node.attrs["heightEmu"] ?? 0);
      const alt = String(node.attrs["alt"] ?? "");
      const widthPx = widthEmu > 0 ? Math.round(widthEmu / 9525) : 0;
      const heightPx = heightEmu > 0 ? Math.round(heightEmu / 9525) : 0;
      const RENDERABLE = /* @__PURE__ */ new Set([
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/bmp",
        "image/svg+xml"
      ]);
      if (data && RENDERABLE.has(contentType)) {
        const attrs2 = {
          "data-pmd-image": "",
          src: `data:${contentType};base64,${data}`,
          alt,
          "data-width-emu": String(widthEmu),
          "data-height-emu": String(heightEmu),
          style: "max-width: 100%; height: auto;"
        };
        if (widthPx > 0) attrs2["width"] = String(widthPx);
        if (heightPx > 0) attrs2["height"] = String(heightPx);
        return ["img", attrs2];
      }
      const sizeStyle = widthPx > 0 && heightPx > 0 ? `width: ${widthPx}px; height: ${heightPx}px;` : "min-width: 80px; min-height: 80px;";
      const subtype = contentType.replace(/^image\//, "").replace(/^x-/, "");
      const label = `[${subtype} image]`;
      return [
        "span",
        {
          "data-pmd-image": "",
          "data-image-data": data,
          "data-content-type": contentType,
          "data-width-emu": String(widthEmu),
          "data-height-emu": String(heightEmu),
          "data-alt": alt,
          class: "pmd-image-placeholder",
          title: alt ? `${label} \u2014 ${alt}` : label,
          style: sizeStyle
        },
        label
      ];
    }
  },
  /**
   * Footnote / endnote reference — round-trips OOXML
   * `<w:footnoteReference w:id>` (+ `word/footnotes.xml`) and the
   * endnote equivalents.
   *
   * Like `image`, the node is self-contained: the note's body is
   * flattened into the `content` attr as paragraphs of simplified runs
   * ({ text, bold?, italic?, underline?, link? }) so it survives JSON
   * round-trips (.cmir, clipboard, undo) with no sidecar. Debate
   * footnotes are near-always read-only source citations, so the
   * simplified-run model deliberately avoids ProseMirror's
   * nested-content footnote pattern (inner EditorView, selection/undo
   * handoff) — display + light editing happens in the popover
   * (footnote-popover.ts).
   *
   * Rendering: an empty <sup>; the visible number is a pure CSS
   * counter (see .pmd-footnote-ref in style.css), so ordinals track
   * document order with zero bookkeeping.
   */
  footnote: {
    inline: true,
    group: "inline",
    atom: true,
    attrs: {
      /** 'footnote' (page bottom) or 'endnote' (document end). */
      kind: {
        default: "footnote",
        validate: (v) => v === "footnote" || v === "endnote"
      },
      /** Paragraphs of simplified runs — see FootnoteContent. */
      content: {
        default: [],
        validate: (v) => Array.isArray(v) && v.every((p) => Array.isArray(p))
      }
    },
    parseDOM: [
      {
        tag: "sup.pmd-footnote-ref",
        getAttrs: (dom) => {
          const kind = dom.getAttribute("data-kind") === "endnote" ? "endnote" : "footnote";
          let content = [];
          try {
            content = JSON.parse(dom.getAttribute("data-content") ?? "[]");
          } catch {
            content = [];
          }
          if (!Array.isArray(content) || !content.every((p) => Array.isArray(p))) content = [];
          return { kind, content };
        }
      }
    ],
    toDOM: (node) => [
      "sup",
      {
        class: `pmd-footnote-ref pmd-footnote-kind-${String(node.attrs["kind"])}`,
        "data-kind": String(node.attrs["kind"]),
        "data-content": JSON.stringify(node.attrs["content"] ?? [])
      }
    ]
  },
  /**
   * Transclusion "live zone" — a region mirroring the contents under a heading
   * in another CardMirror file (see TRANSCLUSION_PLAN.md).
   *
   * The transcluded cards are REAL child nodes (same block content as the doc),
   * so the zone is self-contained (a `.cmir` renders its zones anywhere it's
   * moved; a judge with none of the source files still sees the evidence), the
   * cards show up in the outline and Find, and — crucially — the zone is
   * EDITABLE: you can contextualise a tag or its highlighting in place without
   * breaking the link. Divergence from the last-pulled source is tracked by
   * `source_content_hash` (the NodeView shows an "edited" dot). Refresh
   * (desktop only) re-reads the source and replaces the children (confirming
   * first when edited); Detach unwraps the children and drops the link;
   * `.docx` export flattens (the zone is a transparent container).
   *
   * `isolating` keeps edits inside the zone (it moves and merges as a unit).
   * Rendering (the rail chrome + editable body) is the NodeView's job
   * (transclusion-nodeview.ts). The `.cmir` path round-trips via `toJSON`
   * (attrs + children serialize generically), independent of toDOM.
   */
  transclusion_ref: {
    content: BLOCK_CONTENT,
    isolating: true,
    defining: true,
    attrs: {
      /** Path to the source `.cmir`. Relative to the transcluding doc when
       *  `source_ref_base` is 'doc', or relative to a shared library root when
       *  'root' (both files live in the same team Dropbox folder). */
      source_ref: {
        default: "",
        validate: (v) => typeof v === "string"
      },
      /** How `source_ref` is anchored: 'doc' (relative to this document) or
       *  'root' (relative to a configured library/Dropbox root — survives the
       *  doc being moved within the shared folder). */
      source_ref_base: {
        default: "doc",
        validate: (v) => v === "doc" || v === "root"
      },
      /** Stable heading UUID of the target section in the source. */
      source_heading_id: {
        default: "",
        validate: (v) => typeof v === "string"
      },
      /** The absolute path the ref was created against, used ONLY as a resolve
       *  tie-breaker: if this exact path still exists here (and inside an allowed
       *  root), it's the definitively-intended file — a local copy vs. the shared
       *  original, or a same-machine refresh. Machine-specific, so it silently
       *  doesn't match on another teammate's machine and resolution falls back to
       *  the relative `source_ref`. */
      source_abs: {
        default: "",
        validate: (v) => typeof v === "string"
      },
      /** Hash of the children AS LAST PULLED from source. The zone is "edited"
       *  when the current children hash differs — that's how local
       *  contextualisation is detected without breaking the link. */
      source_content_hash: {
        default: "",
        validate: (v) => typeof v === "string"
      },
      /** Id-INDEPENDENT hash of the source section as last pulled. Unlike
       *  `source_content_hash` (which includes the freshly-stamped child ids and
       *  so only detects LOCAL edits), this is the source's content signature
       *  ignoring heading ids — so a later read of the source can be compared to
       *  it to tell whether the SOURCE has moved on ("diverged"), independent of
       *  any local edits to the mirror. '' on zones created before this existed;
       *  such zones fall back to the mirror's own shape when unedited. */
      source_shape_hash: {
        default: "",
        validate: (v) => typeof v === "string"
      },
      /** Epoch ms of the last successful resolve (0 = never refreshed). */
      last_refreshed: {
        default: 0,
        validate: (v) => typeof v === "number" && Number.isFinite(v)
      },
      /** Human breadcrumb for the header bar, e.g. "Impacts › Decline…". */
      source_label: {
        default: "",
        validate: (v) => typeof v === "string"
      }
    },
    parseDOM: [
      {
        tag: "div.pmd-transclusion-ref",
        // Content (children) is parsed from the div's contents; only the
        // link metadata comes from data-attributes.
        getAttrs: (dom) => {
          const lr = Number(dom.getAttribute("data-last-refreshed") ?? "0");
          return {
            source_ref: dom.getAttribute("data-source-ref") ?? "",
            source_ref_base: dom.getAttribute("data-source-ref-base") === "root" ? "root" : "doc",
            source_heading_id: dom.getAttribute("data-source-heading-id") ?? "",
            source_content_hash: dom.getAttribute("data-source-content-hash") ?? "",
            last_refreshed: Number.isFinite(lr) ? lr : 0,
            source_label: dom.getAttribute("data-source-label") ?? "",
            source_abs: dom.getAttribute("data-source-abs") ?? ""
          };
        }
      }
    ],
    toDOM: (node) => [
      "div",
      {
        class: "pmd-transclusion-ref",
        "data-source-ref": String(node.attrs["source_ref"] ?? ""),
        "data-source-ref-base": String(node.attrs["source_ref_base"] ?? "doc"),
        "data-source-heading-id": String(node.attrs["source_heading_id"] ?? ""),
        "data-source-content-hash": String(node.attrs["source_content_hash"] ?? ""),
        "data-last-refreshed": String(node.attrs["last_refreshed"] ?? 0),
        "data-source-label": String(node.attrs["source_label"] ?? ""),
        "data-source-abs": String(node.attrs["source_abs"] ?? "")
      },
      0
    ]
  },
  /**
   * Intra-document live window ("self-transclusion"). A by-REFERENCE, read-only
   * projection of another section of THIS document: it stores only which section
   * it mirrors (`source_heading_id`) — no content copy — and its NodeView renders
   * that section's current content live (self-transclusion-nodeview.ts). `atom`:
   * you edit at the source, never through the window (which is what makes it
   * conflict-free — one editable copy, N live views). Flattens to plain cards on
   * `.docx` export (Word has no live-window concept); round-trips by reference in
   * `.cmir` (the source is in the same file, so the file stays self-contained).
   */
  self_ref: {
    // A live view holds its mirrored section as REAL, read-only child content
    // (not a leaf atom). That's what makes native selection just work — there's
    // no atom boundary to get stuck on; a selection flows through it exactly like
    // a linked copy (`transclusion_ref`). The children are DERIVED: a plugin keeps
    // them equal to the projected source (id-less), edits inside are blocked by a
    // filterTransaction, and the children are kept OUT of collab sync (a
    // loro-prosemirror patch) so each peer re-derives them locally from the shared
    // source — never a CRDT value, so no concurrent-re-projection conflict.
    content: BLOCK_CONTENT,
    isolating: true,
    defining: true,
    selectable: true,
    attrs: {
      /** Stable heading id of the mirrored section, in THIS document. */
      source_heading_id: {
        default: "",
        validate: (v) => typeof v === "string"
      },
      /** Human label for the window header, e.g. "↳ Impacts". */
      source_label: {
        default: "",
        validate: (v) => typeof v === "string"
      }
    },
    parseDOM: [
      {
        tag: "div.pmd-self-ref",
        getAttrs: (dom) => ({
          source_heading_id: dom.getAttribute("data-source-heading-id") ?? "",
          source_label: dom.getAttribute("data-source-label") ?? ""
        })
      }
    ],
    toDOM: (node) => [
      "div",
      {
        class: "pmd-self-ref",
        "data-source-heading-id": String(node.attrs["source_heading_id"] ?? ""),
        "data-source-label": String(node.attrs["source_label"] ?? "")
      },
      0
    ]
  },
  /**
   * Heading paragraphs — flat in document order, hierarchy via the
   * derived outline view, not schema containment.
   */
  pocket: {
    content: "inline*",
    attrs: headingAttrs,
    defining: true,
    parseDOM: [{
      tag: "h1.pmd-pocket",
      getAttrs: (dom) => ({ indent: readIndentFromStyle(dom) })
    }],
    toDOM: (node) => {
      const attrs2 = {
        class: "pmd-pocket",
        "data-id": String(node.attrs["id"] ?? "")
      };
      const style = indentToStyle(node.attrs["indent"]);
      if (style) attrs2["style"] = style;
      return ["h1", attrs2, 0];
    }
  },
  hat: {
    content: "inline*",
    attrs: headingAttrs,
    defining: true,
    parseDOM: [{
      tag: "h2.pmd-hat",
      getAttrs: (dom) => ({ indent: readIndentFromStyle(dom) })
    }],
    toDOM: (node) => {
      const attrs2 = {
        class: "pmd-hat",
        "data-id": String(node.attrs["id"] ?? "")
      };
      const style = indentToStyle(node.attrs["indent"]);
      if (style) attrs2["style"] = style;
      return ["h2", attrs2, 0];
    }
  },
  block: {
    content: "inline*",
    attrs: blockAttrs,
    defining: true,
    parseDOM: [{
      tag: "h3.pmd-block",
      getAttrs: (dom) => ({
        indent: readIndentFromStyle(dom),
        // Default is restart (true); only a "continue" block carries the attr.
        numRestart: dom.getAttribute("data-num-restart") !== "false"
      })
    }],
    toDOM: (node) => {
      const attrs2 = {
        class: "pmd-block",
        "data-id": String(node.attrs["id"] ?? "")
      };
      const style = indentToStyle(node.attrs["indent"]);
      if (style) attrs2["style"] = style;
      if (node.attrs["numRestart"] === false) attrs2["data-num-restart"] = "false";
      return ["h3", attrs2, 0];
    }
  },
  /**
   * A card: required tag followed by any combination of supplementary
   * paragraphs (undertags, cite, card body) plus inline tables.
   *
   * Analytics are NOT card children: an analytic anchors its own
   * `analytic_unit`. An analytic that ends up inside a card — a legacy
   * `.cmir` file, or a `.docx` whose author put an Analytic paragraph
   * under a tag — is split out into a trailing analytic_unit (that
   * absorbs the content below it) on load (`schema/migrate.ts`'s
   * `splitInCardAnalytics`) and on import, mirroring what pasting an
   * analytic into a card already does.
   *
   * Content after the tag is order-free rather than a strict
   * `tag undertag* cite_paragraph? card_body*` sequence, so editing
   * operations can insert a card_body in any position — e.g., Enter at
   * end of tag drops a new body directly under the tag, above any
   * pre-existing cite/body.
   *
   * Undertags belong to the tag they follow — they don't mark a card
   * boundary.
   */
  card: {
    // Order matters: ProseMirror's splitBlock command (and other
    // schema-driven defaults) calls `defaultBlockAt` to pick the
    // "natural" type for a freshly-created paragraph in this slot.
    // It returns the FIRST textblock in the alternation. Putting
    // `card_body` first ensures that pressing Enter at the start of a
    // cite (or anywhere else inside a card) creates a normal body
    // paragraph — never an undertag. Undertag styling is reserved for
    // text the user explicitly opts into.
    content: "tag (card_body | undertag | cite_paragraph | table)*",
    defining: true,
    isolating: true,
    attrs: numberingCardAttrs,
    parseDOM: [{
      tag: "div.pmd-card",
      getAttrs: (dom) => {
        const r = dom.getAttribute("data-num-role");
        return {
          numRole: r === "number" || r === "sub" ? r : "none",
          numRestart: dom.getAttribute("data-num-restart") === "true"
        };
      }
    }],
    toDOM: (node) => {
      const attrs2 = {
        class: "pmd-card",
        style: intrinsicHeightStyle(node)
      };
      const role = node.attrs["numRole"];
      if (role && role !== "none") attrs2["data-num-role"] = String(role);
      if (node.attrs["numRestart"] === true) attrs2["data-num-restart"] = "true";
      return ["div", attrs2, 0];
    }
  },
  /** Card label. Heading-level outline-4 with stable id. Card-only. */
  tag: {
    content: "inline*",
    attrs: headingAttrs,
    defining: true,
    parseDOM: [{
      tag: "h4.pmd-tag",
      getAttrs: (dom) => ({ indent: readIndentFromStyle(dom) })
    }],
    toDOM: (node) => {
      const attrs2 = {
        class: "pmd-tag",
        "data-id": String(node.attrs["id"] ?? "")
      };
      const style = indentToStyle(node.attrs["indent"]);
      if (style) attrs2["style"] = style;
      return ["h4", attrs2, 0];
    }
  },
  /** Cite paragraph. Used inside a card or at the doc level. */
  cite_paragraph: {
    content: "inline*",
    attrs: { ...indentAttr, ...spacingAttr },
    parseDOM: [{
      tag: "p.pmd-cite-para",
      getAttrs: (dom) => ({ indent: readIndentFromStyle(dom) })
    }],
    toDOM: (node) => {
      const attrs2 = { class: "pmd-cite-para" };
      const style = indentToStyle(node.attrs["indent"]);
      if (style) attrs2["style"] = style;
      return ["p", attrs2, 0];
    }
  },
  /** Card body paragraph — implicit Normal style on export. */
  card_body: {
    content: "inline*",
    attrs: { ...indentAttr, ...spacingAttr },
    parseDOM: [{
      tag: "p.pmd-card-body",
      getAttrs: (dom) => ({ indent: readIndentFromStyle(dom) })
    }],
    toDOM: (node) => {
      const attrs2 = { class: "pmd-card-body" };
      const style = indentToStyle(node.attrs["indent"]);
      if (style) attrs2["style"] = style;
      return ["p", attrs2, 0];
    }
  },
  /**
   * Analytic paragraph — outline-level-4 with stable id. Distinct from
   * a tag in styling (color #1F3864) and semantic role. Appears as the
   * required first child of an `analytic_unit`, OR as a cite-position
   * alternative inside a `card`.
   */
  analytic: {
    content: "inline*",
    attrs: headingAttrs,
    defining: true,
    parseDOM: [{
      tag: "p.pmd-analytic",
      getAttrs: (dom) => ({ indent: readIndentFromStyle(dom) })
    }],
    toDOM: (node) => {
      const attrs2 = {
        class: "pmd-analytic",
        "data-id": String(node.attrs["id"] ?? "")
      };
      const style = indentToStyle(node.attrs["indent"]);
      if (style) attrs2["style"] = style;
      return ["p", attrs2, 0];
    }
  },
  /**
   * An analytic-rooted unit, peer to `card`. Required analytic, optional
   * undertag(s), zero+ body paragraphs, and cite_paragraphs. Cite
   * paragraphs aren't a conventional part of an analytic — analytics
   * are commentary, not external evidence — but allowing them here
   * keeps cite-paste uniform across card and analytic_unit
   * destinations and avoids forced new-card creation when the user
   * just wants a cite below an analytic's body. Drags as a unit.
   */
  analytic_unit: {
    // Same alternation shape as `card` — see its content expression's
    // comment for why `card_body` comes first.
    content: "analytic (card_body | undertag | cite_paragraph | table)*",
    defining: true,
    isolating: true,
    attrs: numberingCardAttrs,
    parseDOM: [{
      tag: "div.pmd-analytic-unit",
      getAttrs: (dom) => {
        const r = dom.getAttribute("data-num-role");
        return {
          numRole: r === "number" || r === "sub" ? r : "none",
          numRestart: dom.getAttribute("data-num-restart") === "true"
        };
      }
    }],
    toDOM: (node) => {
      const attrs2 = {
        class: "pmd-analytic-unit",
        style: intrinsicHeightStyle(node)
      };
      const role = node.attrs["numRole"];
      if (role && role !== "none") attrs2["data-num-role"] = String(role);
      if (node.attrs["numRestart"] === true) attrs2["data-num-restart"] = "true";
      return ["div", attrs2, 0];
    }
  },
  /** Undertag paragraph (linked to UndertagChar). */
  undertag: {
    content: "inline*",
    attrs: { ...indentAttr, ...spacingAttr },
    parseDOM: [{
      tag: "p.pmd-undertag",
      getAttrs: (dom) => ({ indent: readIndentFromStyle(dom) })
    }],
    toDOM: (node) => {
      const attrs2 = { class: "pmd-undertag" };
      const style = indentToStyle(node.attrs["indent"]);
      if (style) attrs2["style"] = style;
      return ["p", attrs2, 0];
    }
  },
  /** Generic body paragraph — implicit Normal style. Optional
   *  `alignment` attr surfaces OOXML's `<w:jc>` for paragraphs in
   *  contexts where alignment matters (table cells especially —
   *  Word tables routinely center their cell content). Null means
   *  default (left/inherited). Values match Word's set. */
  paragraph: {
    content: "inline*",
    attrs: {
      alignment: {
        default: null,
        validate: (v) => v === null || v === "left" || v === "center" || v === "right" || v === "justify"
      },
      ...indentAttr,
      ...spacingAttr
    },
    parseDOM: [
      {
        tag: "p",
        getAttrs: (dom) => {
          const align = dom.style.textAlign || null;
          return {
            alignment: align === "left" || align === "center" || align === "right" || align === "justify" ? align : null,
            indent: readIndentFromStyle(dom)
          };
        }
      }
    ],
    toDOM: (node) => {
      const align = node.attrs["alignment"];
      const indentStyle = indentToStyle(node.attrs["indent"]);
      const styles = [];
      if (align) styles.push(`text-align: ${align}`);
      if (indentStyle) styles.push(indentStyle);
      const attrs2 = {};
      if (styles.length > 0) attrs2["style"] = styles.join("; ");
      return ["p", attrs2, 0];
    }
  },
  // ---- Tables (prosemirror-tables compatible) -------------------
  // Round-tripped from OOXML <w:tbl> / <w:tr> / <w:tc>. Cells hold
  // generic paragraphs only — no cards / analytics / pockets etc.
  // inside cells (matches OOXML's "no nesting of structural debate
  // elements inside table cells" practice).
  //
  // Cell attrs follow prosemirror-tables' convention so the
  // built-in commands (addRowAfter, deleteRow, mergeCells, etc.)
  // work without adaptation.
  table: {
    content: "table_row+",
    tableRole: "table",
    isolating: true,
    group: "block",
    attrs: {
      // Opaque OOXML `<w:tblPr>` inner content captured at import time
      // and re-emitted verbatim on export. Lets us round-trip table-
      // level borders / styles / shading without modeling each
      // property in the schema. New tables created in the editor have
      // this null and get the exporter's default tblPr.
      rawTblPr: {
        default: null,
        validate: (v) => v === null || typeof v === "string"
      }
    },
    parseDOM: [{ tag: "table" }],
    toDOM: () => ["table", { class: "pmd-table" }, ["tbody", 0]]
  },
  table_row: {
    content: "(table_cell | table_header)*",
    tableRole: "row",
    parseDOM: [{ tag: "tr" }],
    toDOM: () => ["tr", 0]
  },
  table_cell: {
    content: "paragraph+",
    attrs: {
      colspan: { default: 1, validate: (v) => typeof v === "number" && v >= 1 },
      rowspan: { default: 1, validate: (v) => typeof v === "number" && v >= 1 },
      colwidth: {
        default: null,
        validate: (v) => v === null || Array.isArray(v) && v.every((n) => typeof n === "number")
      },
      // Opaque OOXML `<w:tcPr>` children captured at import time
      // (everything except `gridSpan`, `vMerge`, and `tcW`, which are
      // derived from the cell's structural attrs). Re-emitted after
      // the structural bits on export so per-cell borders / shading /
      // vAlign etc. round-trip.
      rawTcPr: {
        default: null,
        validate: (v) => v === null || typeof v === "string"
      }
    },
    tableRole: "cell",
    isolating: true,
    parseDOM: [
      {
        tag: "td",
        getAttrs: (dom) => readCellAttrs(dom)
      }
    ],
    toDOM: (node) => ["td", cellAttrsToDom(node.attrs), 0]
  },
  // Defined for prosemirror-tables compatibility even though OOXML
  // doesn't distinguish header cells from body cells. Importer always
  // produces table_cell; we keep table_header so the plugin's
  // commands (e.g. toggleHeaderRow) function should the user invoke
  // them.
  table_header: {
    content: "paragraph+",
    attrs: {
      colspan: { default: 1, validate: (v) => typeof v === "number" && v >= 1 },
      rowspan: { default: 1, validate: (v) => typeof v === "number" && v >= 1 },
      colwidth: {
        default: null,
        validate: (v) => v === null || Array.isArray(v) && v.every((n) => typeof n === "number")
      },
      // See `table_cell.rawTcPr` for the round-trip contract.
      rawTcPr: {
        default: null,
        validate: (v) => v === null || typeof v === "string"
      }
    },
    tableRole: "header_cell",
    isolating: true,
    parseDOM: [
      {
        tag: "th",
        getAttrs: (dom) => readCellAttrs(dom)
      }
    ],
    toDOM: (node) => ["th", cellAttrsToDom(node.attrs), 0]
  }
};
function readCellAttrs(dom) {
  const colspan = parseInt(dom.getAttribute("colspan") || "1", 10) || 1;
  const rowspan = parseInt(dom.getAttribute("rowspan") || "1", 10) || 1;
  const widthAttr = dom.getAttribute("data-colwidth");
  const colwidth = widthAttr ? widthAttr.split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n)) : null;
  return { colspan, rowspan, colwidth };
}
function cellAttrsToDom(attrs2) {
  const out = {};
  const colspan = Number(attrs2["colspan"] ?? 1);
  const rowspan = Number(attrs2["rowspan"] ?? 1);
  if (colspan !== 1) out["colspan"] = String(colspan);
  if (rowspan !== 1) out["rowspan"] = String(rowspan);
  const colwidth = attrs2["colwidth"];
  if (colwidth && colwidth.length > 0) {
    out["data-colwidth"] = colwidth.join(",");
  }
  return out;
}

// src/schema/marks.ts
function namedStyleMark() {
  return {
    inclusive: true
  };
}
function colorBand(hex) {
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "dark";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.4 ? "dark" : "light";
}
var HIGHLIGHT_BAND = {
  yellow: "light",
  green: "light",
  cyan: "light",
  magenta: "light",
  red: "light",
  lightGray: "light",
  blue: "dark",
  darkBlue: "dark",
  darkCyan: "dark",
  darkGreen: "dark",
  darkMagenta: "dark",
  darkRed: "dark",
  darkYellow: "dark",
  darkGray: "dark",
  black: "dark",
  none: "none"
};
var marks = {
  // -------- Outermost: per-run font size --------
  // `font_size` is listed first so it renders as the OUTERMOST DOM
  // wrapper. CSS paints an inline element's background/border on a box
  // sized by its OWN font-size, not its descendants'. Putting font_size
  // outermost means visible wrappers (emphasis box, highlight band,
  // strikethrough line, etc.) inherit the per-run size and size their
  // boxes correctly when the user scales text up or down. Order within
  // this object literal sets mark rank: earlier = lower rank = outer
  // DOM. Word treats direct `<w:sz>` as overriding a character style's
  // size, so this also matches OOXML semantics.
  font_size: {
    inclusive: true,
    attrs: {
      // Half-points (OOXML convention): 22 = 11pt, 24 = 12pt, 26 = 13pt, etc.
      halfPoints: {
        default: 22,
        validate: (v) => typeof v === "number" && Number.isInteger(v) && v > 0
      },
      // Provenance: 'shrink' when the protection-aware sizing machinery
      // (shrink/regrow cycle, smart shrink) applied the size; null for
      // sizes the user chose (size chip, ± nudge, pasted content). The
      // collab invariant heal strips ONLY 'shrink'-origin sizes that
      // fuse with underline/emphasis at CRDT merge — Peritext range
      // marks cover concurrently-inserted interior text, so a partner's
      // underlined typing inside a shrunk span inherits the small size
      // with no op recording it. Intentionally absent from parseDOM/
      // toDOM: clipboard round-trips demote to null (= manual), so the
      // heal can only under-fire, never eat a deliberate size.
      origin: {
        default: null,
        validate: (v) => v === null || v === "shrink"
      }
    },
    parseDOM: [
      {
        tag: "span[data-half-points]",
        getAttrs: (dom) => {
          const v = dom.getAttribute("data-half-points");
          const n = v ? parseInt(v, 10) : 22;
          return { halfPoints: Number.isFinite(n) ? n : 22 };
        }
      }
    ],
    toDOM: (mark) => {
      const hp = Number(mark.attrs["halfPoints"] ?? 22);
      return [
        "span",
        {
          style: `font-size: ${hp / 2}pt; --pmd-run-font-size: ${hp / 2}pt`,
          "data-half-points": String(hp)
        },
        0
      ];
    }
  },
  // -------- Named-style emphasis marks --------
  cite_mark: {
    ...namedStyleMark(),
    // The three named-style "evidence" marks are mutually exclusive
    // — at most one of {cite, underline, emphasis} on any character.
    // Symmetric so that whichever mark is being added via tr.addMark
    // strips the others automatically. For passive coexistence
    // (legacy import data carrying overlapping marks), the named-
    // style normalizer plugin enforces cite/emphasis precedence over
    // underline.
    excludes: "cite_mark underline_mark emphasis_mark",
    parseDOM: [{ tag: "span.pmd-cite" }],
    toDOM: () => ["span", { class: "pmd-cite" }, 0]
  },
  underline_mark: {
    ...namedStyleMark(),
    excludes: "cite_mark underline_mark emphasis_mark",
    parseDOM: [{ tag: "span.pmd-underline" }],
    toDOM: () => ["span", { class: "pmd-underline" }, 0]
  },
  /**
   * Direct underline (no named style). Used in structural textblocks
   * (tag / analytic / pocket / hat / block / undertag) where applying
   * the named-style "Underline" would semantically mis-classify the
   * text. Round-trips to a bare `<w:u w:val="single"/>` with no
   * `<w:rStyle/>`. The named-style-normalizer plugin keeps the
   * body-vs-structural invariant (no underline_direct in body, no
   * underline_mark in structural).
   */
  underline_direct: {
    inclusive: true,
    parseDOM: [{ tag: "u" }],
    toDOM: () => ["u", 0]
  },
  emphasis_mark: {
    ...namedStyleMark(),
    excludes: "cite_mark underline_mark emphasis_mark",
    parseDOM: [{ tag: "span.pmd-emphasis" }],
    toDOM: () => ["span", { class: "pmd-emphasis" }, 0]
  },
  undertag_mark: {
    ...namedStyleMark(),
    parseDOM: [{ tag: "span.pmd-undertag-mark" }],
    toDOM: () => ["span", { class: "pmd-undertag-mark" }, 0]
  },
  analytic_mark: {
    ...namedStyleMark(),
    parseDOM: [{ tag: "span.pmd-analytic-mark" }],
    toDOM: () => ["span", { class: "pmd-analytic-mark" }, 0]
  },
  /**
   * Pilcrow marker — a non-inclusive mark applied to the 6-pt `¶`
   * characters Branch B inserts at original paragraph boundaries.
   * Non-inclusive so the cursor adjacent to a pilcrow doesn't pick
   * up its formatting and typing nearby stays at the surrounding
   * text size. Round-trips as `<w:r><w:rPr><w:sz w:val="12"/></w:rPr>
   * <w:t>¶</w:t></w:r>` — the exporter writes the equivalent of a
   * 6-pt `font_size` mark for any run carrying this marker, and the
   * importer recognizes the same pattern on the way back in.
   */
  pilcrow_marker: {
    inclusive: false,
    parseDOM: [{ tag: "span.pmd-pilcrow" }],
    toDOM: () => ["span", { class: "pmd-pilcrow" }, 0]
  },
  // -------- Direct-formatting marks --------
  bold: {
    inclusive: true,
    // Mutually exclusive with bold_off — a run is either bold or
    // explicitly-not-bold, never both.
    excludes: "bold bold_off",
    parseDOM: [
      { tag: "b" },
      { tag: "strong" },
      { style: "font-weight", getAttrs: (v) => /^(bold|[5-9]\d{2})/.test(String(v)) && null }
    ],
    toDOM: () => ["strong", 0]
  },
  /**
   * Explicit "not bold" — overrides the bold a structural block (tag /
   * analytic / pocket / hat / block) renders by DEFAULT via CSS, so a word
   * inside a tag can be un-bolded. Renders an inline `font-weight: normal`,
   * which beats the `.pmd-tag { font-weight: bold }` rule, tagged with
   * `data-bold-off` for a clean editor round-trip. Round-trips to OOXML
   * `<w:b w:val="0"/>`. In body text (not bold by default) it's a harmless
   * no-op, but it still faithfully preserves an explicit Word "bold off".
   *
   * Like `font_size`, it parses only its own `data-bold-off` span — NOT an
   * arbitrary `font-weight: normal` — so it isn't sprayed onto every paste
   * that carries an explicit-normal weight. The docx importer adds it
   * directly from `<w:b w:val="0"/>`.
   */
  bold_off: {
    inclusive: true,
    excludes: "bold bold_off",
    parseDOM: [{ tag: "span[data-bold-off]" }],
    toDOM: () => ["span", { "data-bold-off": "true", style: "font-weight: normal" }, 0]
  },
  italic: {
    inclusive: true,
    parseDOM: [
      { tag: "i" },
      { tag: "em" },
      { style: "font-style=italic" }
    ],
    toDOM: () => ["em", 0]
  },
  /**
   * Strikethrough — `<w:strike/>` in OOXML. Renders as `<s>`. We don't
   * differentiate single-strike vs double-strike (`<w:dstrike/>`); the
   * importer maps both to this mark and the exporter writes single-strike.
   */
  strikethrough: {
    inclusive: true,
    parseDOM: [
      { tag: "s" },
      { tag: "strike" },
      { tag: "del" },
      { style: "text-decoration", getAttrs: (v) => /line-through/.test(String(v)) && null }
    ],
    toDOM: () => ["s", 0]
  },
  /**
   * Vertical alignment — `<w:vertAlign w:val="superscript|subscript"/>`
   * in OOXML. Two separate marks so the natural ProseMirror mark
   * lifecycle (toggle, exclude) handles mutual exclusion; a single
   * baseline of normal is the absence of either mark. Renders as
   * native `<sup>` / `<sub>` so browsers handle the baseline shift
   * and ~0.83em font scaling without per-mark CSS.
   */
  superscript: {
    inclusive: true,
    excludes: "superscript subscript",
    parseDOM: [
      { tag: "sup" },
      { style: "vertical-align", getAttrs: (v) => /super/.test(String(v)) && null }
    ],
    toDOM: () => ["sup", 0]
  },
  subscript: {
    inclusive: true,
    excludes: "superscript subscript",
    parseDOM: [
      { tag: "sub" },
      { style: "vertical-align", getAttrs: (v) => /sub/.test(String(v)) && null }
    ],
    toDOM: () => ["sub", 0]
  },
  link: {
    inclusive: false,
    attrs: {
      href: {
        default: "",
        validate: (v) => typeof v === "string"
      }
    },
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs: (dom) => ({
          href: dom.getAttribute("href") ?? ""
        })
      }
    ],
    toDOM: (mark) => [
      "a",
      { href: String(mark.attrs["href"] ?? "") },
      0
    ]
  },
  /**
   * Shading — `<w:shd w:fill="…"/>`, an RGB background that survives
   * Word's "remove highlighting" (which only strips `<w:highlight>`).
   * Verbatim's `HighlightToBackgroundColor` uses this as "protected
   * highlight" (canonically D2D2D2 grey). Defined BEFORE `highlight`
   * so highlight nests inside shading in the DOM — when both marks
   * coexist on the same run, highlight's background wins visually.
   */
  shading: {
    inclusive: true,
    attrs: {
      // Hex RGB, no leading "#"
      color: {
        default: "D2D2D2",
        validate: (v) => typeof v === "string" && /^[0-9a-fA-F]{6}$/.test(v)
      }
    },
    parseDOM: [
      {
        tag: "span[data-shading]",
        getAttrs: (dom) => ({
          color: dom.getAttribute("data-shading") ?? "D2D2D2"
        })
      }
    ],
    toDOM: (mark) => {
      const color = String(mark.attrs["color"] ?? "D2D2D2");
      return [
        "span",
        {
          style: `background-color: #${color}; --sh: #${color}`,
          "data-shading": color,
          "data-shading-band": colorBand(color)
        },
        0
      ];
    }
  },
  highlight: {
    inclusive: true,
    attrs: {
      // OOXML highlight values: "yellow", "green", "cyan", "magenta", "blue",
      // "red", "darkBlue", "darkCyan", "darkGreen", "darkMagenta", "darkRed",
      // "darkYellow", "darkGray", "lightGray", "black", "none"
      color: {
        default: "yellow",
        validate: (v) => typeof v === "string"
      }
    },
    parseDOM: [
      { tag: "mark", getAttrs: () => ({ color: "yellow" }) },
      {
        tag: "span.pmd-highlight",
        getAttrs: (dom) => ({
          color: dom.dataset["highlight"] ?? "yellow"
        })
      }
    ],
    // Rendered as <span class="pmd-highlight"> rather than <mark>:
    // class targeting survives ProseMirror view-layer element
    // normalization that can defeat element-typed CSS rules.
    // Emphasis box padding is 0 so the highlight bg reaches the box's
    // inner border edge with no gap, even though emphasis is OUTER to
    // highlight in mark rank (a continuous emphasis run renders as one
    // `.pmd-emphasis` span regardless of which sub-runs carry
    // highlight — no phantom internal borders).
    toDOM: (mark) => {
      const color = String(mark.attrs["color"] ?? "yellow");
      return [
        "span",
        {
          class: "pmd-highlight",
          "data-highlight": color,
          "data-highlight-band": HIGHLIGHT_BAND[color] ?? "none"
        },
        0
      ];
    }
  },
  font_color: {
    inclusive: true,
    attrs: {
      // Hex string, no leading "#" (OOXML convention): "555555", "1F3864", etc.
      color: {
        default: "000000",
        validate: (v) => typeof v === "string" && /^[0-9a-fA-F]{6}$/.test(v)
      }
    },
    parseDOM: [
      {
        tag: "span[data-color]",
        getAttrs: (dom) => ({
          color: dom.getAttribute("data-color") ?? "000000"
        })
      }
    ],
    toDOM: (mark) => {
      const color = String(mark.attrs["color"] ?? "000000");
      const attrs2 = {
        "data-color": color,
        "data-color-band": colorBand(color)
      };
      if (color !== "000000") attrs2["style"] = `color: #${color}`;
      return ["span", attrs2, 0];
    }
  },
  /**
   * Per-run font family override. Round-trips to OOXML `<w:rFonts>`
   * (importer reads w:ascii / w:hAnsi / w:cs; exporter emits all three
   * to the same value). Intentionally NOT rendered in the editor — the
   * mark is data-only, with a span wrapper carrying a `data-font-family`
   * attribute. The body font (settings.bodyFont) governs how the editor
   * renders. Round-trip preserves the user's per-run font overrides
   * verbatim regardless.
   */
  font_family: {
    inclusive: true,
    attrs: {
      name: {
        default: "",
        validate: (v) => typeof v === "string"
      }
    },
    parseDOM: [
      {
        tag: "span[data-font-family]",
        getAttrs: (dom) => ({
          name: dom.getAttribute("data-font-family") ?? ""
        })
      }
    ],
    toDOM: (mark) => [
      "span",
      {
        "data-font-family": String(mark.attrs["name"] ?? "")
      },
      0
    ]
  },
  /**
   * Comment anchor — references a thread in the comments plugin
   * state via `threadId`. Non-inclusive so typing past either end
   * of a commented range doesn't extend the anchor. Renders as a
   * span with a `data-comment-id` attribute the CSS uses to draw
   * the subtle inline indicator. Thread content (author / text /
   * replies) lives in plugin state, not on the mark.
   *
   * Round-trips as `<w:commentRangeStart>` / `<w:commentRangeEnd>`
   * brackets in document.xml; the actual comment data goes into
   * `word/comments.xml` (+ `word/commentsExtended.xml` for thread
   * relationships).
   */
  comment_range: {
    inclusive: false,
    attrs: {
      threadId: {
        default: "",
        validate: (v) => typeof v === "string"
      }
    },
    parseDOM: [
      {
        tag: "span[data-comment-id]",
        getAttrs: (dom) => ({
          threadId: dom.getAttribute("data-comment-id") ?? ""
        })
      }
    ],
    toDOM: (mark) => [
      "span",
      {
        class: "pmd-comment-range",
        "data-comment-id": String(mark.attrs["threadId"] ?? "")
      },
      0
    ]
  }
};

// src/schema/index.ts
var schema = new Schema({ nodes, marks });

// src/schema/salvage.ts
function preview(node) {
  const text = node.textContent.replace(/\s+/g, " ").trim();
  return { type: node.type.name, textPreview: text.slice(0, 80) };
}
function attrsValid(node) {
  const t = node.type;
  if (typeof t.checkAttrs !== "function") return true;
  try {
    t.checkAttrs(node.attrs);
    return true;
  } catch {
    return false;
  }
}
function marksAllowed(child, parent) {
  return child.marks.every((m) => parent.allowsMarkType(m.type));
}
function salvageNode(node, dropped) {
  if (node.isText) return node;
  if (!attrsValid(node)) {
    dropped.push(preview(node));
    return null;
  }
  const reportMark = dropped.length;
  const kids = [];
  node.forEach((child) => {
    const s = salvageNode(child, dropped);
    if (s) kids.push(s);
  });
  let match = node.type.contentMatch;
  const kept = [];
  for (const child of kids) {
    if (!marksAllowed(child, node.type)) {
      dropped.push(preview(child));
      continue;
    }
    let next = match.matchType(child.type);
    if (!next) {
      const fill = match.fillBefore(Fragment.from(child));
      if (fill && fill.childCount > 0) {
        fill.forEach((f) => {
          kept.push(f);
          match = match.matchType(f.type) ?? match;
        });
        next = match.matchType(child.type);
      }
    }
    if (next) {
      match = next;
      kept.push(child);
    } else {
      dropped.push(preview(child));
    }
  }
  if (!match.validEnd) {
    const fill = match.fillBefore(Fragment.empty, true);
    if (!fill) {
      dropped.length = reportMark;
      dropped.push(preview(node));
      return null;
    }
    fill.forEach((n) => kept.push(n));
  }
  return node.type.create(node.attrs, Fragment.fromArray(kept), node.marks);
}
function salvageDoc(doc) {
  const dropped = [];
  const out = salvageNode(doc, dropped);
  if (!out) return null;
  try {
    out.check();
  } catch {
    return null;
  }
  return { doc: out, dropped };
}

// src/schema/migrate.ts
function splitInCardAnalytics(doc) {
  let changed = false;
  const out = [];
  doc.forEach((child) => {
    if (child.type.name === "card" && cardHasAnalytic(child)) {
      changed = true;
      out.push(...splitCardOnAnalytics(child));
    } else {
      out.push(child);
    }
  });
  if (!changed) return doc;
  return doc.type.create(doc.attrs, Fragment.fromArray(out), doc.marks);
}
function flattenNestedZones(doc) {
  let changed = false;
  const out = [];
  doc.forEach((child) => {
    if (child.type.name === "transclusion_ref") {
      const flat = unwrapZonesIn(child.content);
      if (flat !== child.content) {
        changed = true;
        out.push(child.type.create(child.attrs, flat, child.marks));
      } else {
        out.push(child);
      }
    } else {
      out.push(child);
    }
  });
  if (!changed) return doc;
  return doc.type.create(doc.attrs, Fragment.fromArray(out), doc.marks);
}
function dropEmptyZones(doc) {
  let changed = false;
  const out = [];
  doc.forEach((child) => {
    if (child.type.name === "transclusion_ref" && child.content.size === 0) {
      changed = true;
      return;
    }
    out.push(child);
  });
  return changed ? doc.type.create(doc.attrs, Fragment.fromArray(out), doc.marks) : doc;
}
function healAnalyticUnits(doc) {
  const healed = healUnitsIn(doc.content);
  return healed === doc.content ? doc : doc.type.create(doc.attrs, healed, doc.marks);
}
function unitNeedsHeal(unit) {
  if (unit.childCount === 0) return true;
  let bad = unit.firstChild.type.name !== "analytic";
  unit.forEach((c, _off, idx) => {
    if (idx > 0 && c.type.name === "analytic") bad = true;
  });
  return bad;
}
function healUnitsIn(frag) {
  let changed = false;
  const out = [];
  frag.forEach((child) => {
    if (child.type.name === "transclusion_ref") {
      const inner = healUnitsIn(child.content);
      if (inner !== child.content) {
        changed = true;
        out.push(child.type.create(child.attrs, inner, child.marks));
      } else {
        out.push(child);
      }
      return;
    }
    if (child.type.name === "analytic_unit" && unitNeedsHeal(child)) {
      changed = true;
      const kids = [];
      child.forEach((c) => kids.push(c));
      let i = 0;
      while (i < kids.length && kids[i].type.name !== "analytic") {
        out.push(kids[i]);
        i++;
      }
      while (i < kids.length) {
        const unitChildren = [kids[i]];
        i++;
        while (i < kids.length && kids[i].type.name !== "analytic") {
          unitChildren.push(kids[i]);
          i++;
        }
        out.push(child.type.create(child.attrs, Fragment.fromArray(unitChildren), child.marks));
      }
      return;
    }
    out.push(child);
  });
  return changed ? Fragment.fromArray(out) : frag;
}
function healCards(doc) {
  const healed = healCardsIn(doc.content);
  return healed === doc.content ? doc : doc.type.create(doc.attrs, healed, doc.marks);
}
function cardNeedsHeal(card) {
  if (card.childCount === 0) return true;
  let bad = card.firstChild.type.name !== "tag";
  card.forEach((c, _off, idx) => {
    if (idx > 0 && c.type.name === "tag") bad = true;
  });
  return bad;
}
function healCardsIn(frag) {
  let changed = false;
  const out = [];
  frag.forEach((child) => {
    if (child.type.name === "transclusion_ref") {
      const inner = healCardsIn(child.content);
      if (inner !== child.content) {
        changed = true;
        out.push(child.type.create(child.attrs, inner, child.marks));
      } else {
        out.push(child);
      }
      return;
    }
    if (child.type.name === "card" && cardNeedsHeal(child)) {
      changed = true;
      const kids = [];
      child.forEach((c) => kids.push(c));
      let i = 0;
      while (i < kids.length && kids[i].type.name !== "tag") {
        out.push(kids[i]);
        i++;
      }
      while (i < kids.length) {
        const cardChildren = [kids[i]];
        i++;
        while (i < kids.length && kids[i].type.name !== "tag") {
          cardChildren.push(kids[i]);
          i++;
        }
        out.push(child.type.create(child.attrs, Fragment.fromArray(cardChildren), child.marks));
      }
      return;
    }
    out.push(child);
  });
  return changed ? Fragment.fromArray(out) : frag;
}
function healTables(doc) {
  function walk2(node) {
    if (node.type.name === "table" && node.childCount === 0) return null;
    if ((node.type.name === "table_cell" || node.type.name === "table_header") && node.childCount === 0) {
      return node.type.create(
        node.attrs,
        Fragment.from(schema.nodes["paragraph"].create()),
        node.marks
      );
    }
    if (node.isText || node.childCount === 0) return node;
    let changed = false;
    const out = [];
    node.forEach((child) => {
      const w = walk2(child);
      if (w === null) {
        changed = true;
        return;
      }
      if (w !== child) changed = true;
      out.push(w);
    });
    return changed ? node.type.create(node.attrs, Fragment.fromArray(out), node.marks) : node;
  }
  return walk2(doc) ?? doc;
}
function unwrapZonesIn(frag) {
  let changed = false;
  const out = [];
  frag.forEach((child) => {
    const inner = child.content.size ? unwrapZonesIn(child.content) : child.content;
    const node = inner === child.content ? child : child.type.create(child.attrs, inner, child.marks);
    if (node.type.name === "transclusion_ref") {
      changed = true;
      node.content.forEach((c) => out.push(c));
    } else {
      if (node !== child) changed = true;
      out.push(node);
    }
  });
  return changed ? Fragment.fromArray(out) : frag;
}
var IMAGE_ALLOWED_MARKS = /* @__PURE__ */ new Set([
  "comment_range",
  "link"
]);
function stripImageVisualMarks(doc) {
  function walk2(node) {
    if (node.type.name === "image") {
      const kept = node.marks.filter((m) => IMAGE_ALLOWED_MARKS.has(m.type.name));
      return kept.length === node.marks.length ? node : node.mark(kept);
    }
    if (node.isText || node.childCount === 0) return node;
    let changed = false;
    const out = [];
    node.forEach((child) => {
      const w = walk2(child);
      if (w !== child) changed = true;
      out.push(w);
    });
    return changed ? node.type.create(node.attrs, Fragment.fromArray(out), node.marks) : node;
  }
  return walk2(doc);
}
function cardHasAnalytic(card) {
  let found2 = false;
  card.forEach((c) => {
    if (c.type.name === "analytic") found2 = true;
  });
  return found2;
}
function splitCardOnAnalytics(card) {
  const kids = [];
  card.forEach((c) => kids.push(c));
  const result = [];
  let i = 0;
  const cardChildren = [];
  while (i < kids.length && kids[i].type.name !== "analytic") {
    cardChildren.push(kids[i]);
    i++;
  }
  result.push(card.type.create(card.attrs, Fragment.fromArray(cardChildren), card.marks));
  while (i < kids.length) {
    const unitChildren = [kids[i]];
    i++;
    while (i < kids.length && kids[i].type.name !== "analytic") {
      unitChildren.push(kids[i]);
      i++;
    }
    result.push(
      schema.nodes["analytic_unit"].create(null, Fragment.fromArray(unitChildren))
    );
  }
  return result;
}

// node_modules/fflate/esm/index.mjs
var import_module = require("module");
var require2 = (0, import_module.createRequire)("/");
var _a;
var Worker;
var isMarkedAsUntransferable;
try {
  _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
} catch (e) {
}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0; i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1; i < 30; ++i) {
    for (var j = b[i]; j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i = 0;
  var l = new u16(mb);
  for (; i < s; ++i) {
    if (cd[i])
      ++l[cd[i] - 1];
  }
  var le = new u16(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = le[i - 1] + l[i - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        var sv = i << 4 | cd[i];
        var r_1 = mb - cd[i];
        var v = le[cd[i] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i = 1; i < a.length; ++i) {
    if (a[i] > m)
      m = a[i];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i = 0; i < hcLen; ++i) {
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i = 0; i < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i = sym - 257, b = fleb[i];
          add = bits(dat, pos, (1 << b) - 1) + fl[i];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift2 = dl - dt, dend = Math.min(dt, end);
          if (shift2 + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift2 + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i = 0; i < d.length; ++i) {
    if (d[i])
      t.push({ s: i, f: d[i] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i2].f ? i0++ : i2++];
    r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i = 1; i < s; ++i) {
    if (t2[i].s > maxSym)
      maxSym = t2[i].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i < s; ++i) {
      var i2_1 = t2[i].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i;
    }
    for (; i >= 0 && dt; --i) {
      var i2_3 = t2[i].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i = 1; i <= s; ++i) {
    if (c[i] == cln && i != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i = 0; i < cl.length; ++i)
    l += cf[i] * cl[i];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i = 0; i < s; ++i)
    out[o + i + 4] = dat[i];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i = 0; i < lclt.length; ++i)
    ++lcfreq[lclt[i] & 31];
  for (var i = 0; i < lcdt.length; ++i)
    ++lcfreq[lcdt[i] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i = 0; i < nlcc; ++i)
      wbits(out, p + 3 * i, lct[clim[i]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i = 0; i < clct.length; ++i) {
        var len = clct[i] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i = 0; i < li; ++i) {
    var sym = syms[i];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i2) {
      return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i + 2 < s; ++i) {
      var hv = hsh(i);
      var imod = i & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i) {
        var rem = s - i;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
          li = lc_1 = eb = 0, bs = i;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i + l] == dat[i + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i];
          ++lf[dat[i]];
        }
      }
    }
    for (i = Math.max(i, wi); i < s; ++i) {
      syms[li++] = dat[i];
      ++lf[dat[i]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i, st.w = wi;
    }
  } else {
    for (var i = st.w || 0; i < s + lst; i += 65535) {
      var e = i + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var crct = /* @__PURE__ */ (function() {
  var t = new Int32Array(256);
  for (var i = 0; i < 256; ++i) {
    var c = i, k = 9;
    while (--k)
      c = (c & 1 && -306674912) ^ c >>> 1;
    t[i] = c;
  }
  return t;
})();
var crc = function() {
  var c = -1;
  return {
    p: function(d) {
      var cr = c;
      for (var i = 0; i < d.length; ++i)
        cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
      c = cr;
    },
    d: function() {
      return ~c;
    }
  };
};
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
};
var mrg = function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
};
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
var wbytes = function(d, b, v) {
  for (; v; ++b)
    d[b] = v, v >>>= 8;
};
var gzh = function(c, o) {
  var fn = o.filename;
  c[0] = 31, c[1] = 139, c[2] = 8, c[8] = o.level < 2 ? 4 : o.level == 9 ? 2 : 0, c[9] = 3;
  if (o.mtime != 0)
    wbytes(c, 4, Math.floor(new Date(o.mtime || Date.now()) / 1e3));
  if (fn) {
    c[3] = 8;
    for (var i = 0; i <= fn.length; ++i)
      c[i + 10] = fn.charCodeAt(i);
  }
};
var gzs = function(d) {
  if (d[0] != 31 || d[1] != 139 || d[2] != 8)
    err(6, "invalid gzip data");
  var flg = d[3];
  var st = 10;
  if (flg & 4)
    st += (d[10] | d[11] << 8) + 2;
  for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
    ;
  return st + (flg & 2);
};
var gzl = function(d) {
  var l = d.length;
  return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
};
var gzhl = function(o) {
  return 10 + (o.filename ? o.filename.length + 1 : 0);
};
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
function gzipSync(data, opts) {
  if (!opts)
    opts = {};
  var c = crc(), l = data.length;
  c.p(data);
  var d = dopt(data, opts, gzhl(opts), 8), s = d.length;
  return gzh(d, opts), wbytes(d, s - 8, c.d()), wbytes(d, s - 4, l), d;
}
function gunzipSync(data, opts) {
  var st = gzs(data);
  if (st + 8 > data.length)
    err(6, "invalid gzip data");
  return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
}
var fltn = function(d, p, t, o) {
  for (var k in d) {
    var val = d[k], n = p + k, op = o;
    if (Array.isArray(val))
      op = mrg(o, val[1]), val = val[0];
    if (ArrayBuffer.isView(val))
      t[n] = [val, op];
    else {
      t[n += "/"] = [new u8(0), op];
      fltn(val, n, t, o);
    }
  }
};
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = function(d) {
  for (var r = "", i = 0; ; ) {
    var c = d[i++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i + eb > d.length)
      return { s: r, r: slc(d, i - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | d[i++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i++] & 63) << 6 | d[i++] & 63);
  }
};
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i = 0; i < str.length; ++i)
      ar_1[i] = str.charCodeAt(i);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i = 0; i < l; ++i) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i = 0; i < dat.length; i += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var slzh = function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
  var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
  var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
};
var z64hs = function(d, b, l, z, sc, su, off) {
  var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
  var nf = nsc + nsu + noff;
  if (z && nf) {
    for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
      if (b2(d, b) == 1) {
        return [
          nsc ? b8(d, b + 4 + 8 * nsu) : sc,
          nsu ? b8(d, b + 4) : su,
          noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
          1
        ];
      }
    }
    if (z < 2)
      err(13);
  }
  return [sc, su, off, 0];
};
var exfl = function(ex) {
  var le = 0;
  if (ex) {
    for (var k in ex) {
      var l = ex[k].length;
      if (l > 65535)
        err(9);
      le += l + 4;
    }
  }
  return le;
};
var wzh = function(d, b, f, fn, u, c, ce, co) {
  var fl2 = fn.length, ex = f.extra, col = co && co.length;
  var exl = exfl(ex);
  wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
  if (ce != null)
    d[b++] = 20, d[b++] = f.os;
  d[b] = 20, b += 2;
  d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
  d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
  var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
  if (y < 0 || y > 119)
    err(10);
  wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
  if (c != -1) {
    wbytes(d, b, f.crc);
    wbytes(d, b + 4, c < 0 ? -c - 2 : c);
    wbytes(d, b + 8, f.size);
  }
  wbytes(d, b + 12, fl2);
  wbytes(d, b + 14, exl), b += 16;
  if (ce != null) {
    wbytes(d, b, col);
    wbytes(d, b + 6, f.attrs);
    wbytes(d, b + 10, ce), b += 14;
  }
  d.set(fn, b);
  b += fl2;
  if (exl) {
    for (var k in ex) {
      var exf = ex[k], l = exf.length;
      wbytes(d, b, +k);
      wbytes(d, b + 2, l);
      d.set(exf, b + 4), b += 4 + l;
    }
  }
  if (col)
    d.set(co, b), b += col;
  return b;
};
var wzf = function(o, b, c, d, e) {
  wbytes(o, b, 101010256);
  wbytes(o, b + 8, c);
  wbytes(o, b + 10, c);
  wbytes(o, b + 12, d);
  wbytes(o, b + 16, e);
};
function zipSync(data, opts) {
  if (!opts)
    opts = {};
  var r = {};
  var files = [];
  fltn(data, "", r, opts);
  var o = 0;
  var tot = 0;
  for (var fn in r) {
    var _a2 = r[fn], file = _a2[0], p = _a2[1];
    var compression = p.level == 0 ? 0 : 8;
    var f = strToU8(fn), s = f.length;
    var com = p.comment, m = com && strToU8(com), ms = m && m.length;
    var exl = exfl(p.extra);
    if (s > 65535)
      err(11);
    var d = compression ? deflateSync(file, p) : file, l = d.length;
    var c = crc();
    c.p(file);
    files.push(mrg(p, {
      size: file.length,
      crc: c.d(),
      c: d,
      f,
      m,
      u: s != fn.length || m && com.length != ms,
      o,
      compression
    }));
    o += 30 + s + exl + l;
    tot += 76 + 2 * (s + exl) + (ms || 0) + l;
  }
  var out = new u8(tot + 22), oe = o, cdl = tot - o;
  for (var i = 0; i < files.length; ++i) {
    var f = files[i];
    wzh(out, f.o, f, f.f, f.u, f.c.length);
    var badd = 30 + f.f.length + exfl(f.extra);
    out.set(f.c, f.o + badd);
    wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
  }
  wzf(out, o, files.length, cdl, oe);
  return out;
}
function unzipSync(data, opts) {
  var files = {};
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558)
      err(13);
  }
  ;
  var c = b2(data, e + 8);
  if (!c)
    return {};
  var o = b4(data, e + 16);
  var z = b4(data, e - 20) == 117853008;
  if (z) {
    var ze = b4(data, e - 12);
    z = b4(data, ze) == 101075792;
    if (z) {
      c = b4(data, ze + 32);
      o = b4(data, ze + 48);
    }
  }
  var fltr = opts && opts.filter;
  for (var i = 0; i < c; ++i) {
    var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
    o = no;
    if (!fltr || fltr({
      name: fn,
      size: sc,
      originalSize: su,
      compression: c_2
    })) {
      if (!c_2)
        files[fn] = slc(data, b, b + sc);
      else if (c_2 == 8)
        files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
      else
        err(14, "unknown compression type " + c_2);
    }
  }
  return files;
}

// src/native/codec.ts
function isGzip(bytes) {
  return bytes.length >= 2 && bytes[0] === 31 && bytes[1] === 139;
}
function gzip2(bytes) {
  return gzipSync(bytes, { level: 6, mtime: 0 });
}
function gunzip(bytes) {
  return gunzipSync(bytes);
}

// src/native/index.ts
var FORMAT_ID = "cardmirror-doc";
var FORMAT_VERSION = 1;
var saveHealListener = null;
function tripwireForSave(doc) {
  try {
    doc.check();
    return doc;
  } catch (err3) {
    const error = err3 instanceof Error ? err3.message : String(err3);
    const healedDoc = healTables(healCards(healAnalyticUnits(doc)));
    let healed = false;
    let out = doc;
    try {
      healedDoc.check();
      healed = true;
      out = healedDoc;
    } catch {
    }
    if (saveHealListener) saveHealListener({ error, healed });
    else console.error(`[cardmirror] invalid doc at save (healed=${healed}): ${error}`);
    return out;
  }
}
function buildNativeEnvelope(doc, opts) {
  const file = {
    format: FORMAT_ID,
    formatVersion: FORMAT_VERSION,
    createdBy: opts.appVersion ?? "CardMirror",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    doc: tripwireForSave(doc).toJSON()
  };
  if (opts.threads && opts.threads.length > 0) {
    file.threads = [...opts.threads];
  }
  if (opts.docId) {
    file.docId = opts.docId;
  }
  return new TextEncoder().encode(JSON.stringify(file));
}
function serializeNative(doc, opts = {}) {
  return gzip2(buildNativeEnvelope(doc, opts));
}
var NativeDamagedError = class extends Error {
  name = "NativeDamagedError";
};
function parseNative(bytes) {
  return parseNativeImpl(bytes, false);
}
function parseNativeImpl(bytes, salvage) {
  if (bytes.length === 0) {
    throw new Error(
      "This file is empty or hasn\u2019t finished downloading. If it lives in Dropbox or iCloud Drive, it may be set to \u201Conline only\u201D \u2014 make it available offline (in Finder, right-click \u2192 Make available offline / Download Now), then open it again."
    );
  }
  let parsed;
  try {
    const raw = isGzip(bytes) ? gunzip(bytes) : bytes;
    const text = new TextDecoder().decode(raw);
    parsed = JSON.parse(text);
  } catch (err3) {
    throw new Error(
      `Not a CardMirror file: failed to parse JSON (${err3 instanceof Error ? err3.message : err3}).`
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Not a CardMirror file: expected a JSON object.");
  }
  const file = parsed;
  if (file.format !== FORMAT_ID) {
    throw new Error(
      `Not a CardMirror file: missing or unrecognized format identifier (${String(file.format)}).`
    );
  }
  if (typeof file.formatVersion !== "number") {
    throw new Error("CardMirror file is missing formatVersion.");
  }
  if (file.formatVersion > FORMAT_VERSION) {
    throw new Error(
      `CardMirror file uses formatVersion ${file.formatVersion}, which is newer than this build supports (max ${FORMAT_VERSION}). Update CardMirror to read this file.`
    );
  }
  if (file.doc === void 0) {
    throw new Error("CardMirror file is missing its doc field.");
  }
  let doc;
  let dropped;
  try {
    doc = stripImageVisualMarks(
      dropEmptyZones(
        healTables(
          healCards(
            healAnalyticUnits(
              flattenNestedZones(
                splitInCardAnalytics(stampMissingHeadingIds(schema.nodeFromJSON(file.doc)))
              )
            )
          )
        )
      )
    );
    if (doc.type !== schema.nodes["doc"]) {
      throw new Error(`top-level node is "${doc.type.name}", not a document`);
    }
    try {
      doc.check();
    } catch (checkErr) {
      if (!salvage) throw checkErr;
      const salvaged = salvageDoc(doc);
      if (!salvaged) throw checkErr;
      doc = salvaged.doc;
      dropped = salvaged.dropped;
    }
  } catch (err3) {
    throw new NativeDamagedError(
      `This CardMirror file is damaged and can\u2019t be opened (${err3 instanceof Error ? err3.message : String(err3)}).`
    );
  }
  return {
    doc,
    threads: Array.isArray(file.threads) ? file.threads : [],
    docId: typeof file.docId === "string" && file.docId ? file.docId : null,
    meta: {
      createdBy: typeof file.createdBy === "string" ? file.createdBy : "",
      createdAt: typeof file.createdAt === "string" ? file.createdAt : "",
      formatVersion: file.formatVersion
    },
    ...dropped ? { dropped } : {}
  };
}
function looksLikeNative(bytes) {
  let head = bytes;
  if (isGzip(bytes)) {
    try {
      head = gunzip(bytes);
    } catch {
      return false;
    }
  }
  return new TextDecoder().decode(head.subarray(0, 256)).includes(`"${FORMAT_ID}"`);
}

// src/ooxml/xml.ts
var XML_ILLEGAL_OR_PAIR = /([\uD800-\uDBFF][\uDC00-\uDFFF])|[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF\uD800-\uDFFF]/g;
function stripXmlIllegal(s) {
  return s.replace(XML_ILLEGAL_OR_PAIR, (_m, pair) => pair ?? "");
}
function escText(s) {
  return stripXmlIllegal(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s) {
  return stripXmlIllegal(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
var XML_PROLOG = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// src/ooxml/styles.ts
function canonicalStylesXml(defaultFont = "Calibri") {
  const f = escAttr(defaultFont);
  return `${XML_PROLOG}
<w:styles xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsiaTheme="minorEastAsia" w:cstheme="minorBidi"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="259" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:aliases w:val="Normal/Card"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">
    <w:name w:val="Default Paragraph Font"/>
    <w:uiPriority w:val="1"/>
    <w:semiHidden/>
    <w:unhideWhenUsed/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:aliases w:val="Pocket"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:link w:val="Heading1Char"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:pageBreakBefore/>
      <w:pBdr>
        <w:top w:val="single" w:sz="24" w:space="1" w:color="auto"/>
        <w:left w:val="single" w:sz="24" w:space="4" w:color="auto"/>
        <w:bottom w:val="single" w:sz="24" w:space="1" w:color="auto"/>
        <w:right w:val="single" w:sz="24" w:space="4" w:color="auto"/>
      </w:pBdr>
      <w:spacing w:before="480"/>
      <w:jc w:val="center"/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="52"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:aliases w:val="Hat"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:link w:val="Heading2Char"/>
    <w:uiPriority w:val="1"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:pageBreakBefore/>
      <w:spacing w:before="480"/>
      <w:jc w:val="center"/>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="44"/>
      <w:szCs w:val="26"/>
      <w:u w:val="double"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:aliases w:val="Block"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:link w:val="Heading3Char"/>
    <w:uiPriority w:val="2"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:pageBreakBefore/>
      <w:spacing w:before="200"/>
      <w:jc w:val="center"/>
      <w:outlineLvl w:val="2"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="32"/>
      <w:szCs w:val="24"/>
      <w:u w:val="single"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:aliases w:val="Tag"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:link w:val="Heading4Char"/>
    <w:uiPriority w:val="3"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:spacing w:before="200"/>
      <w:outlineLvl w:val="3"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:iCs/>
      <w:sz w:val="26"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="Heading1Char">
    <w:name w:val="Heading 1 Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Heading1"/>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="52"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="Heading2Char">
    <w:name w:val="Heading 2 Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Heading2"/>
    <w:uiPriority w:val="1"/>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="44"/>
      <w:szCs w:val="26"/>
      <w:u w:val="double"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="Heading3Char">
    <w:name w:val="Heading 3 Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Heading3"/>
    <w:uiPriority w:val="2"/>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="32"/>
      <w:szCs w:val="24"/>
      <w:u w:val="single"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="Heading4Char">
    <w:name w:val="Heading 4 Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Heading4"/>
    <w:uiPriority w:val="3"/>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:iCs/>
      <w:sz w:val="26"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:styleId="Emphasis">
    <w:name w:val="Emphasis"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:uiPriority w:val="8"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:b w:val="0"/>
      <w:i w:val="0"/>
      <w:iCs/>
      <w:sz w:val="22"/>
      <w:u w:val="single"/>
      <w:bdr w:val="single" w:sz="8" w:space="0" w:color="auto"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="Style13ptBold">
    <w:name w:val="Style 13 pt Bold"/>
    <w:aliases w:val="Cite"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:uiPriority w:val="6"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:bCs/>
      <w:sz w:val="26"/>
      <w:u w:val="none"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="StyleUnderline">
    <w:name w:val="Style Underline"/>
    <w:aliases w:val="Underline"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:uiPriority w:val="7"/>
    <w:qFormat/>
    <w:rPr>
      <w:b w:val="0"/>
      <w:sz w:val="22"/>
      <w:u w:val="single"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="Undertag">
    <w:name w:val="Undertag"/>
    <w:basedOn w:val="Normal"/>
    <w:link w:val="UndertagChar"/>
    <w:autoRedefine/>
    <w:uiPriority w:val="5"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:after="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:eastAsiaTheme="majorEastAsia" w:hAnsi="Times New Roman" w:cstheme="majorBidi"/>
      <w:i/>
      <w:iCs/>
      <w:color w:val="385623" w:themeColor="accent6" w:themeShade="80"/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="UndertagChar">
    <w:name w:val="Undertag Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Undertag"/>
    <w:uiPriority w:val="5"/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:eastAsiaTheme="majorEastAsia" w:hAnsi="Times New Roman" w:cstheme="majorBidi"/>
      <w:i/>
      <w:iCs/>
      <w:color w:val="385623" w:themeColor="accent6" w:themeShade="80"/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="Analytic">
    <w:name w:val="Analytic"/>
    <w:basedOn w:val="Heading4"/>
    <w:link w:val="AnalyticChar"/>
    <w:autoRedefine/>
    <w:uiPriority w:val="5"/>
    <w:qFormat/>
    <w:rPr>
      <w:color w:val="1F3864" w:themeColor="accent1" w:themeShade="80"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="AnalyticChar">
    <w:name w:val="Analytic Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Analytic"/>
    <w:uiPriority w:val="5"/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:eastAsiaTheme="majorEastAsia" w:hAnsi="Times New Roman" w:cstheme="majorBidi"/>
      <w:b/>
      <w:iCs/>
      <w:color w:val="1F3864" w:themeColor="accent1" w:themeShade="80"/>
      <w:sz w:val="26"/>
    </w:rPr>
  </w:style>
</w:styles>`;
}
var CANONICAL_STYLES_XML = canonicalStylesXml();
var PSTYLE_TO_NODE = {
  Heading1: "pocket",
  Heading2: "hat",
  Heading3: "block",
  Heading4: "tag",
  Analytic: "analytic",
  Undertag: "undertag"
};
function tightenStyleToken(s) {
  return s.toLowerCase().replace(/\s+/g, "");
}
function fallbackNodeType(info) {
  if (!info) return null;
  const name = info.name ? tightenStyleToken(info.name) : "";
  const id = tightenStyleToken(info.id);
  if (name === "analyticreal" || id === "analyticreal") return "analytic";
  if (info.type === "paragraph" && (name.includes("analytic") || id.includes("analytic"))) {
    return "analytic";
  }
  return null;
}
var RSTYLE_TO_MARK = {
  // ─── Underline named-style ──────────────────────────────────
  StyleUnderline: "underline_mark",
  // Aliases / legacy:
  Underline: "underline_mark",
  // Pre-modern Verbatim shipped "Style Bold Underline" (styleId
  // `StyleBoldUnderline`) as the underline character style.
  StyleBoldUnderline: "underline_mark",
  // ─── Cite named-style ───────────────────────────────────────
  Style13ptBold: "cite_mark",
  // Pre-modern Verbatim shipped "Style Style Bold + 12 pt"
  // (styleId `StyleStyleBold12pt`) as the cite character style.
  StyleStyleBold12pt: "cite_mark",
  // Some files carry the cite style under its alias as the styleId
  // (`Cite`) instead of `Style13ptBold` — e.g. after a rename, or in an
  // older/variant Verbatim distribution. Safe to map: an `rStyle` only ever
  // references a character style, so a run-level `Cite` is the cite mark.
  Cite: "cite_mark",
  // ─── Emphasis / structural marks ────────────────────────────
  Emphasis: "emphasis_mark",
  UndertagChar: "undertag_mark",
  AnalyticChar: "analytic_mark"
};

// src/ooxml/docx.ts
var utf8Decoder = new TextDecoder("utf-8");
var utf8Encoder = new TextEncoder();
var Docx = class _Docx {
  constructor(parts) {
    this.parts = parts;
  }
  /** Load a .docx from a Uint8Array (Node Buffer / browser ArrayBuffer-derived). */
  static async load(bytes) {
    const u82 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const entries = unzipSync(u82);
    const parts = /* @__PURE__ */ new Map();
    for (const [path, data] of Object.entries(entries)) {
      if (path.endsWith("/")) continue;
      parts.set(path, data);
    }
    return new _Docx(parts);
  }
  /** Construct a fresh, minimal .docx with the canonical style block.
   *  `defaultFont` becomes the literal docDefaults font — read only by
   *  theme-blind converters (previews); Word resolves the theme
   *  attributes instead (see canonicalStylesXml). */
  static empty(opts) {
    const docx = new _Docx(/* @__PURE__ */ new Map());
    docx.writeText("[Content_Types].xml", CONTENT_TYPES_XML);
    docx.writeText("_rels/.rels", TOP_LEVEL_RELS_XML);
    docx.writeText("word/styles.xml", canonicalStylesXml(opts?.defaultFont));
    docx.writeText("word/_rels/document.xml.rels", DOCUMENT_RELS_XML);
    docx.writeText("word/document.xml", EMPTY_DOCUMENT_XML);
    docx.writeText("word/settings.xml", SETTINGS_XML);
    docx.writeText("word/_rels/settings.xml.rels", SETTINGS_RELS_XML);
    return docx;
  }
  /** Read a part as a string. */
  async readText(path) {
    const bytes = this.parts.get(path);
    if (!bytes) return null;
    return utf8Decoder.decode(bytes);
  }
  /** Write or overwrite a part. */
  writeText(path, content) {
    this.parts.set(path, utf8Encoder.encode(content));
  }
  /** Read a part as raw bytes. */
  async readBinary(path) {
    return this.parts.get(path) ?? null;
  }
  /** Write or overwrite a binary part. */
  writeBinary(path, bytes) {
    this.parts.set(path, bytes);
  }
  /** Insert one or more `<Override>` entries into the
   *  `[Content_Types].xml` part. Used by `toDocx` to declare any
   *  optional parts beyond the baseline (comments.xml,
   *  commentsExtended.xml, etc.). */
  async addContentTypeOverrides(overrides) {
    if (overrides.length === 0) return;
    const ct = await this.readText("[Content_Types].xml");
    if (!ct) return;
    const additions = overrides.map((o) => `<Override PartName="${o.partName}" ContentType="${o.contentType}"/>`).join("");
    const updated = ct.replace("</Types>", `${additions}</Types>`);
    this.writeText("[Content_Types].xml", updated);
  }
  /** Write the CardMirror `docId` as a custom document property
   *  (`docProps/custom.xml`) — verified to survive a real Word round-trip.
   *  Adds the part, its content-type override, and a package relationship.
   *  Merges into an existing `custom.xml`, replacing any prior `cmirDocId`
   *  while preserving other custom properties the user or Word set. */
  async writeDocId(docId) {
    const prop = (pid) => `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${pid}" name="cmirDocId"><vt:lpwstr>${escText(docId)}</vt:lpwstr></property>`;
    const existing = await this.readText("docProps/custom.xml");
    let propsXml;
    if (existing && existing.includes("<Properties")) {
      const stripped = existing.replace(
        /<property\b[^>]*\bname="cmirDocId"[^>]*>[\s\S]*?<\/property>/,
        ""
      );
      const pids = [...stripped.matchAll(/\bpid="(\d+)"/g)].map((m) => Number(m[1]));
      const nextPid = (pids.length ? Math.max(...pids) : 1) + 1;
      propsXml = stripped.replace("</Properties>", `${prop(nextPid)}</Properties>`);
    } else {
      propsXml = `${XML_PROLOG}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">${prop(2)}</Properties>`;
    }
    this.writeText("docProps/custom.xml", propsXml);
    const ct = await this.readText("[Content_Types].xml");
    if (ct && !ct.includes("docProps/custom.xml")) {
      this.writeText(
        "[Content_Types].xml",
        ct.replace(
          "</Types>",
          '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>'
        )
      );
    }
    const rels = await this.readText("_rels/.rels");
    if (rels && !rels.includes("custom-properties")) {
      const ids = [...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
      const nextId = `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
      this.writeText(
        "_rels/.rels",
        rels.replace(
          "</Relationships>",
          `<Relationship Id="${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>`
        )
      );
    }
  }
  /** Read the CardMirror `docId` custom property, or null if absent. */
  async readDocId() {
    const xml = await this.readText("docProps/custom.xml");
    if (!xml) return null;
    const m = xml.match(/name="cmirDocId"[^>]*>\s*<vt:lpwstr>([^<]*)<\/vt:lpwstr>/);
    return m ? m[1] : null;
  }
  /** Serialize the zip to bytes. */
  async toBuffer() {
    return zipSync(Object.fromEntries(this.parts), { level: 6 });
  }
  /** List all part paths in the zip. */
  paths() {
    return [...this.parts.keys()];
  }
};
var CONTENT_TYPES_XML = `${XML_PROLOG}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Default Extension="bmp" ContentType="image/bmp"/>
  <Default Extension="svg" ContentType="image/svg+xml"/>
  <Default Extension="webp" ContentType="image/webp"/>
  <Default Extension="tif" ContentType="image/tiff"/>
  <Default Extension="tiff" ContentType="image/tiff"/>
  <Default Extension="emf" ContentType="image/x-emf"/>
  <Default Extension="wmf" ContentType="image/x-wmf"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;
var TOP_LEVEL_RELS_XML = `${XML_PROLOG}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
var DOCUMENT_RELS_XML = `${XML_PROLOG}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
var EMPTY_DOCUMENT_XML = `${XML_PROLOG}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14">
  <w:body>
    <w:p/>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
var SETTINGS_XML = `${XML_PROLOG}
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:attachedTemplate r:id="rId1"/>
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
  </w:compat>
</w:settings>`;
var SETTINGS_RELS_XML = `${XML_PROLOG}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="file:///Debate.dotm" TargetMode="External"/></Relationships>`;

// node_modules/prosemirror-transform/dist/index.js
var lower16 = 65535;
var factor16 = Math.pow(2, 16);
function makeRecover(index, offset) {
  return index + offset * factor16;
}
function recoverIndex(value) {
  return value & lower16;
}
function recoverOffset(value) {
  return (value - (value & lower16)) / factor16;
}
var DEL_BEFORE = 1;
var DEL_AFTER = 2;
var DEL_ACROSS = 4;
var DEL_SIDE = 8;
var MapResult = class {
  /**
  @internal
  */
  constructor(pos, delInfo, recover) {
    this.pos = pos;
    this.delInfo = delInfo;
    this.recover = recover;
  }
  /**
  Tells you whether the position was deleted, that is, whether the
  step removed the token on the side queried (via the `assoc`)
  argument from the document.
  */
  get deleted() {
    return (this.delInfo & DEL_SIDE) > 0;
  }
  /**
  Tells you whether the token before the mapped position was deleted.
  */
  get deletedBefore() {
    return (this.delInfo & (DEL_BEFORE | DEL_ACROSS)) > 0;
  }
  /**
  True when the token after the mapped position was deleted.
  */
  get deletedAfter() {
    return (this.delInfo & (DEL_AFTER | DEL_ACROSS)) > 0;
  }
  /**
  Tells whether any of the steps mapped through deletes across the
  position (including both the token before and after the
  position).
  */
  get deletedAcross() {
    return (this.delInfo & DEL_ACROSS) > 0;
  }
};
var StepMap = class _StepMap {
  /**
  Create a position map. The modifications to the document are
  represented as an array of numbers, in which each group of three
  represents a modified chunk as `[start, oldSize, newSize]`.
  */
  constructor(ranges, inverted = false) {
    this.ranges = ranges;
    this.inverted = inverted;
    if (!ranges.length && _StepMap.empty)
      return _StepMap.empty;
  }
  /**
  @internal
  */
  recover(value) {
    let diff = 0, index = recoverIndex(value);
    if (!this.inverted)
      for (let i = 0; i < index; i++)
        diff += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
    return this.ranges[index * 3] + diff + recoverOffset(value);
  }
  mapResult(pos, assoc = 1) {
    return this._map(pos, assoc, false);
  }
  map(pos, assoc = 1) {
    return this._map(pos, assoc, true);
  }
  /**
  @internal
  */
  _map(pos, assoc, simple) {
    let diff = 0, oldIndex = this.inverted ? 2 : 1, newIndex = this.inverted ? 1 : 2;
    for (let i = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i] - (this.inverted ? diff : 0);
      if (start > pos)
        break;
      let oldSize = this.ranges[i + oldIndex], newSize = this.ranges[i + newIndex], end = start + oldSize;
      if (pos <= end) {
        let side = !oldSize ? assoc : pos == start ? -1 : pos == end ? 1 : assoc;
        let result = start + diff + (side < 0 ? 0 : newSize);
        if (simple)
          return result;
        let recover = pos == (assoc < 0 ? start : end) ? null : makeRecover(i / 3, pos - start);
        let del = pos == start ? DEL_AFTER : pos == end ? DEL_BEFORE : DEL_ACROSS;
        if (assoc < 0 ? pos != start : pos != end)
          del |= DEL_SIDE;
        return new MapResult(result, del, recover);
      }
      diff += newSize - oldSize;
    }
    return simple ? pos + diff : new MapResult(pos + diff, 0, null);
  }
  /**
  @internal
  */
  touches(pos, recover) {
    let diff = 0, index = recoverIndex(recover);
    let oldIndex = this.inverted ? 2 : 1, newIndex = this.inverted ? 1 : 2;
    for (let i = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i] - (this.inverted ? diff : 0);
      if (start > pos)
        break;
      let oldSize = this.ranges[i + oldIndex], end = start + oldSize;
      if (pos <= end && i == index * 3)
        return true;
      diff += this.ranges[i + newIndex] - oldSize;
    }
    return false;
  }
  /**
  Calls the given function on each of the changed ranges included in
  this map.
  */
  forEach(f) {
    let oldIndex = this.inverted ? 2 : 1, newIndex = this.inverted ? 1 : 2;
    for (let i = 0, diff = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i], oldStart = start - (this.inverted ? diff : 0), newStart = start + (this.inverted ? 0 : diff);
      let oldSize = this.ranges[i + oldIndex], newSize = this.ranges[i + newIndex];
      f(oldStart, oldStart + oldSize, newStart, newStart + newSize);
      diff += newSize - oldSize;
    }
  }
  /**
  Create an inverted version of this map. The result can be used to
  map positions in the post-step document to the pre-step document.
  */
  invert() {
    return new _StepMap(this.ranges, !this.inverted);
  }
  /**
  @internal
  */
  toString() {
    return (this.inverted ? "-" : "") + JSON.stringify(this.ranges);
  }
  /**
  Create a map that moves all positions by offset `n` (which may be
  negative). This can be useful when applying steps meant for a
  sub-document to a larger document, or vice-versa.
  */
  static offset(n) {
    return n == 0 ? _StepMap.empty : new _StepMap(n < 0 ? [0, -n, 0] : [0, 0, n]);
  }
};
StepMap.empty = new StepMap([]);
var Mapping = class _Mapping {
  /**
  Create a new mapping with the given position maps.
  */
  constructor(maps, mirror, from = 0, to = maps ? maps.length : 0) {
    this.mirror = mirror;
    this.from = from;
    this.to = to;
    this._maps = maps || [];
    this.ownData = !(maps || mirror);
  }
  /**
  The step maps in this mapping.
  */
  get maps() {
    return this._maps;
  }
  /**
  Create a mapping that maps only through a part of this one.
  */
  slice(from = 0, to = this.maps.length) {
    return new _Mapping(this._maps, this.mirror, from, to);
  }
  /**
  Add a step map to the end of this mapping. If `mirrors` is
  given, it should be the index of the step map that is the mirror
  image of this one.
  */
  appendMap(map, mirrors) {
    if (!this.ownData) {
      this._maps = this._maps.slice();
      this.mirror = this.mirror && this.mirror.slice();
      this.ownData = true;
    }
    this.to = this._maps.push(map);
    if (mirrors != null)
      this.setMirror(this._maps.length - 1, mirrors);
  }
  /**
  Add all the step maps in a given mapping to this one (preserving
  mirroring information).
  */
  appendMapping(mapping) {
    for (let i = 0, startSize = this._maps.length; i < mapping._maps.length; i++) {
      let mirr = mapping.getMirror(i);
      this.appendMap(mapping._maps[i], mirr != null && mirr < i ? startSize + mirr : void 0);
    }
  }
  /**
  Finds the offset of the step map that mirrors the map at the
  given offset, in this mapping (as per the second argument to
  `appendMap`).
  */
  getMirror(n) {
    if (this.mirror) {
      for (let i = 0; i < this.mirror.length; i++)
        if (this.mirror[i] == n)
          return this.mirror[i + (i % 2 ? -1 : 1)];
    }
  }
  /**
  @internal
  */
  setMirror(n, m) {
    if (!this.mirror)
      this.mirror = [];
    this.mirror.push(n, m);
  }
  /**
  Append the inverse of the given mapping to this one.
  */
  appendMappingInverted(mapping) {
    for (let i = mapping.maps.length - 1, totalSize = this._maps.length + mapping._maps.length; i >= 0; i--) {
      let mirr = mapping.getMirror(i);
      this.appendMap(mapping._maps[i].invert(), mirr != null && mirr > i ? totalSize - mirr - 1 : void 0);
    }
  }
  /**
  Create an inverted version of this mapping.
  */
  invert() {
    let inverse = new _Mapping();
    inverse.appendMappingInverted(this);
    return inverse;
  }
  /**
  Map a position through this mapping.
  */
  map(pos, assoc = 1) {
    if (this.mirror)
      return this._map(pos, assoc, true);
    for (let i = this.from; i < this.to; i++)
      pos = this._maps[i].map(pos, assoc);
    return pos;
  }
  /**
  Map a position through this mapping, returning a mapping
  result.
  */
  mapResult(pos, assoc = 1) {
    return this._map(pos, assoc, false);
  }
  /**
  @internal
  */
  _map(pos, assoc, simple) {
    let delInfo = 0;
    for (let i = this.from; i < this.to; i++) {
      let map = this._maps[i], result = map.mapResult(pos, assoc);
      if (result.recover != null) {
        let corr = this.getMirror(i);
        if (corr != null && corr > i && corr < this.to) {
          i = corr;
          pos = this._maps[corr].recover(result.recover);
          continue;
        }
      }
      delInfo |= result.delInfo;
      pos = result.pos;
    }
    return simple ? pos : new MapResult(pos, delInfo, null);
  }
};
var stepsByID = /* @__PURE__ */ Object.create(null);
var Step = class {
  /**
  Get the step map that represents the changes made by this step,
  and which can be used to transform between positions in the old
  and the new document.
  */
  getMap() {
    return StepMap.empty;
  }
  /**
  Try to merge this step with another one, to be applied directly
  after it. Returns the merged step when possible, null if the
  steps can't be merged.
  */
  merge(other) {
    return null;
  }
  /**
  Deserialize a step from its JSON representation. Will call
  through to the step class' own implementation of this method.
  */
  static fromJSON(schema2, json) {
    if (!json || !json.stepType)
      throw new RangeError("Invalid input for Step.fromJSON");
    let type = stepsByID[json.stepType];
    if (!type)
      throw new RangeError(`No step type ${json.stepType} defined`);
    return type.fromJSON(schema2, json);
  }
  /**
  To be able to serialize steps to JSON, each step needs a string
  ID to attach to its JSON representation. Use this method to
  register an ID for your step classes. Try to pick something
  that's unlikely to clash with steps from other modules.
  */
  static jsonID(id, stepClass) {
    if (id in stepsByID)
      throw new RangeError("Duplicate use of step JSON ID " + id);
    stepsByID[id] = stepClass;
    stepClass.prototype.jsonID = id;
    return stepClass;
  }
};
var StepResult = class _StepResult {
  /**
  @internal
  */
  constructor(doc, failed) {
    this.doc = doc;
    this.failed = failed;
  }
  /**
  Create a successful step result.
  */
  static ok(doc) {
    return new _StepResult(doc, null);
  }
  /**
  Create a failed step result.
  */
  static fail(message) {
    return new _StepResult(null, message);
  }
  /**
  Call [`Node.replace`](https://prosemirror.net/docs/ref/#model.Node.replace) with the given
  arguments. Create a successful result if it succeeds, and a
  failed one if it throws a `ReplaceError`.
  */
  static fromReplace(doc, from, to, slice) {
    try {
      return _StepResult.ok(doc.replace(from, to, slice));
    } catch (e) {
      if (e instanceof ReplaceError)
        return _StepResult.fail(e.message);
      throw e;
    }
  }
};
function mapFragment(fragment, f, parent) {
  let mapped = [];
  for (let i = 0; i < fragment.childCount; i++) {
    let child = fragment.child(i);
    if (child.content.size)
      child = child.copy(mapFragment(child.content, f, child));
    if (child.isInline)
      child = f(child, parent, i);
    mapped.push(child);
  }
  return Fragment.fromArray(mapped);
}
var AddMarkStep = class _AddMarkStep extends Step {
  /**
  Create a mark step.
  */
  constructor(from, to, mark) {
    super();
    this.from = from;
    this.to = to;
    this.mark = mark;
  }
  apply(doc) {
    let oldSlice = doc.slice(this.from, this.to), $from = doc.resolve(this.from);
    let parent = $from.node($from.sharedDepth(this.to));
    let slice = new Slice(mapFragment(oldSlice.content, (node, parent2) => {
      if (!node.isAtom || !parent2.type.allowsMarkType(this.mark.type))
        return node;
      return node.mark(this.mark.addToSet(node.marks));
    }, parent), oldSlice.openStart, oldSlice.openEnd);
    return StepResult.fromReplace(doc, this.from, this.to, slice);
  }
  invert() {
    return new RemoveMarkStep(this.from, this.to, this.mark);
  }
  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1);
    if (from.deleted && to.deleted || from.pos >= to.pos)
      return null;
    return new _AddMarkStep(from.pos, to.pos, this.mark);
  }
  merge(other) {
    if (other instanceof _AddMarkStep && other.mark.eq(this.mark) && this.from <= other.to && this.to >= other.from)
      return new _AddMarkStep(Math.min(this.from, other.from), Math.max(this.to, other.to), this.mark);
    return null;
  }
  toJSON() {
    return {
      stepType: "addMark",
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to
    };
  }
  /**
  @internal
  */
  static fromJSON(schema2, json) {
    if (typeof json.from != "number" || typeof json.to != "number")
      throw new RangeError("Invalid input for AddMarkStep.fromJSON");
    return new _AddMarkStep(json.from, json.to, schema2.markFromJSON(json.mark));
  }
};
Step.jsonID("addMark", AddMarkStep);
var RemoveMarkStep = class _RemoveMarkStep extends Step {
  /**
  Create a mark-removing step.
  */
  constructor(from, to, mark) {
    super();
    this.from = from;
    this.to = to;
    this.mark = mark;
  }
  apply(doc) {
    let oldSlice = doc.slice(this.from, this.to);
    let slice = new Slice(mapFragment(oldSlice.content, (node) => {
      return node.mark(this.mark.removeFromSet(node.marks));
    }, doc), oldSlice.openStart, oldSlice.openEnd);
    return StepResult.fromReplace(doc, this.from, this.to, slice);
  }
  invert() {
    return new AddMarkStep(this.from, this.to, this.mark);
  }
  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1);
    if (from.deleted && to.deleted || from.pos >= to.pos)
      return null;
    return new _RemoveMarkStep(from.pos, to.pos, this.mark);
  }
  merge(other) {
    if (other instanceof _RemoveMarkStep && other.mark.eq(this.mark) && this.from <= other.to && this.to >= other.from)
      return new _RemoveMarkStep(Math.min(this.from, other.from), Math.max(this.to, other.to), this.mark);
    return null;
  }
  toJSON() {
    return {
      stepType: "removeMark",
      mark: this.mark.toJSON(),
      from: this.from,
      to: this.to
    };
  }
  /**
  @internal
  */
  static fromJSON(schema2, json) {
    if (typeof json.from != "number" || typeof json.to != "number")
      throw new RangeError("Invalid input for RemoveMarkStep.fromJSON");
    return new _RemoveMarkStep(json.from, json.to, schema2.markFromJSON(json.mark));
  }
};
Step.jsonID("removeMark", RemoveMarkStep);
var AddNodeMarkStep = class _AddNodeMarkStep extends Step {
  /**
  Create a node mark step.
  */
  constructor(pos, mark) {
    super();
    this.pos = pos;
    this.mark = mark;
  }
  apply(doc) {
    let node = doc.nodeAt(this.pos);
    if (!node)
      return StepResult.fail("No node at mark step's position");
    let updated = node.type.create(node.attrs, null, this.mark.addToSet(node.marks));
    return StepResult.fromReplace(doc, this.pos, this.pos + 1, new Slice(Fragment.from(updated), 0, node.isLeaf ? 0 : 1));
  }
  invert(doc) {
    let node = doc.nodeAt(this.pos);
    if (node) {
      let newSet = this.mark.addToSet(node.marks);
      if (newSet.length == node.marks.length) {
        for (let i = 0; i < node.marks.length; i++)
          if (!node.marks[i].isInSet(newSet))
            return new _AddNodeMarkStep(this.pos, node.marks[i]);
        return new _AddNodeMarkStep(this.pos, this.mark);
      }
    }
    return new RemoveNodeMarkStep(this.pos, this.mark);
  }
  map(mapping) {
    let pos = mapping.mapResult(this.pos, 1);
    return pos.deletedAfter ? null : new _AddNodeMarkStep(pos.pos, this.mark);
  }
  toJSON() {
    return { stepType: "addNodeMark", pos: this.pos, mark: this.mark.toJSON() };
  }
  /**
  @internal
  */
  static fromJSON(schema2, json) {
    if (typeof json.pos != "number")
      throw new RangeError("Invalid input for AddNodeMarkStep.fromJSON");
    return new _AddNodeMarkStep(json.pos, schema2.markFromJSON(json.mark));
  }
};
Step.jsonID("addNodeMark", AddNodeMarkStep);
var RemoveNodeMarkStep = class _RemoveNodeMarkStep extends Step {
  /**
  Create a mark-removing step.
  */
  constructor(pos, mark) {
    super();
    this.pos = pos;
    this.mark = mark;
  }
  apply(doc) {
    let node = doc.nodeAt(this.pos);
    if (!node)
      return StepResult.fail("No node at mark step's position");
    let updated = node.type.create(node.attrs, null, this.mark.removeFromSet(node.marks));
    return StepResult.fromReplace(doc, this.pos, this.pos + 1, new Slice(Fragment.from(updated), 0, node.isLeaf ? 0 : 1));
  }
  invert(doc) {
    let node = doc.nodeAt(this.pos);
    if (!node || !this.mark.isInSet(node.marks))
      return this;
    return new AddNodeMarkStep(this.pos, this.mark);
  }
  map(mapping) {
    let pos = mapping.mapResult(this.pos, 1);
    return pos.deletedAfter ? null : new _RemoveNodeMarkStep(pos.pos, this.mark);
  }
  toJSON() {
    return { stepType: "removeNodeMark", pos: this.pos, mark: this.mark.toJSON() };
  }
  /**
  @internal
  */
  static fromJSON(schema2, json) {
    if (typeof json.pos != "number")
      throw new RangeError("Invalid input for RemoveNodeMarkStep.fromJSON");
    return new _RemoveNodeMarkStep(json.pos, schema2.markFromJSON(json.mark));
  }
};
Step.jsonID("removeNodeMark", RemoveNodeMarkStep);
var ReplaceStep = class _ReplaceStep extends Step {
  /**
  The given `slice` should fit the 'gap' between `from` and
  `to`—the depths must line up, and the surrounding nodes must be
  able to be joined with the open sides of the slice. When
  `structure` is true, the step will fail if the content between
  from and to is not just a sequence of closing and then opening
  tokens (this is to guard against rebased replace steps
  overwriting something they weren't supposed to).
  */
  constructor(from, to, slice, structure = false) {
    super();
    this.from = from;
    this.to = to;
    this.slice = slice;
    this.structure = structure;
  }
  apply(doc) {
    if (this.structure && contentBetween(doc, this.from, this.to))
      return StepResult.fail("Structure replace would overwrite content");
    return StepResult.fromReplace(doc, this.from, this.to, this.slice);
  }
  getMap() {
    return new StepMap([this.from, this.to - this.from, this.slice.size]);
  }
  invert(doc) {
    return new _ReplaceStep(this.from, this.from + this.slice.size, doc.slice(this.from, this.to));
  }
  map(mapping) {
    let to = mapping.mapResult(this.to, -1);
    let from = this.from == this.to && _ReplaceStep.MAP_BIAS < 0 ? to : mapping.mapResult(this.from, 1);
    if (from.deletedAcross && to.deletedAcross)
      return null;
    return new _ReplaceStep(from.pos, Math.max(from.pos, to.pos), this.slice, this.structure);
  }
  merge(other) {
    if (!(other instanceof _ReplaceStep) || other.structure || this.structure)
      return null;
    if (this.from + this.slice.size == other.from && !this.slice.openEnd && !other.slice.openStart) {
      let slice = this.slice.size + other.slice.size == 0 ? Slice.empty : new Slice(this.slice.content.append(other.slice.content), this.slice.openStart, other.slice.openEnd);
      return new _ReplaceStep(this.from, this.to + (other.to - other.from), slice, this.structure);
    } else if (other.to == this.from && !this.slice.openStart && !other.slice.openEnd) {
      let slice = this.slice.size + other.slice.size == 0 ? Slice.empty : new Slice(other.slice.content.append(this.slice.content), other.slice.openStart, this.slice.openEnd);
      return new _ReplaceStep(other.from, this.to, slice, this.structure);
    } else {
      return null;
    }
  }
  toJSON() {
    let json = { stepType: "replace", from: this.from, to: this.to };
    if (this.slice.size)
      json.slice = this.slice.toJSON();
    if (this.structure)
      json.structure = true;
    return json;
  }
  /**
  @internal
  */
  static fromJSON(schema2, json) {
    if (typeof json.from != "number" || typeof json.to != "number")
      throw new RangeError("Invalid input for ReplaceStep.fromJSON");
    return new _ReplaceStep(json.from, json.to, Slice.fromJSON(schema2, json.slice), !!json.structure);
  }
};
ReplaceStep.MAP_BIAS = 1;
Step.jsonID("replace", ReplaceStep);
var ReplaceAroundStep = class _ReplaceAroundStep extends Step {
  /**
  Create a replace-around step with the given range and gap.
  `insert` should be the point in the slice into which the content
  of the gap should be moved. `structure` has the same meaning as
  it has in the [`ReplaceStep`](https://prosemirror.net/docs/ref/#transform.ReplaceStep) class.
  */
  constructor(from, to, gapFrom, gapTo, slice, insert, structure = false) {
    super();
    this.from = from;
    this.to = to;
    this.gapFrom = gapFrom;
    this.gapTo = gapTo;
    this.slice = slice;
    this.insert = insert;
    this.structure = structure;
  }
  apply(doc) {
    if (this.structure && (contentBetween(doc, this.from, this.gapFrom) || contentBetween(doc, this.gapTo, this.to)))
      return StepResult.fail("Structure gap-replace would overwrite content");
    let gap = doc.slice(this.gapFrom, this.gapTo);
    if (gap.openStart || gap.openEnd)
      return StepResult.fail("Gap is not a flat range");
    let inserted = this.slice.insertAt(this.insert, gap.content);
    if (!inserted)
      return StepResult.fail("Content does not fit in gap");
    return StepResult.fromReplace(doc, this.from, this.to, inserted);
  }
  getMap() {
    return new StepMap([
      this.from,
      this.gapFrom - this.from,
      this.insert,
      this.gapTo,
      this.to - this.gapTo,
      this.slice.size - this.insert
    ]);
  }
  invert(doc) {
    let gap = this.gapTo - this.gapFrom;
    return new _ReplaceAroundStep(this.from, this.from + this.slice.size + gap, this.from + this.insert, this.from + this.insert + gap, doc.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from), this.gapFrom - this.from, this.structure);
  }
  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1);
    let gapFrom = this.from == this.gapFrom ? from.pos : mapping.map(this.gapFrom, -1);
    let gapTo = this.to == this.gapTo ? to.pos : mapping.map(this.gapTo, 1);
    if (from.deletedAcross && to.deletedAcross || gapFrom < from.pos || gapTo > to.pos)
      return null;
    return new _ReplaceAroundStep(from.pos, to.pos, gapFrom, gapTo, this.slice, this.insert, this.structure);
  }
  toJSON() {
    let json = {
      stepType: "replaceAround",
      from: this.from,
      to: this.to,
      gapFrom: this.gapFrom,
      gapTo: this.gapTo,
      insert: this.insert
    };
    if (this.slice.size)
      json.slice = this.slice.toJSON();
    if (this.structure)
      json.structure = true;
    return json;
  }
  /**
  @internal
  */
  static fromJSON(schema2, json) {
    if (typeof json.from != "number" || typeof json.to != "number" || typeof json.gapFrom != "number" || typeof json.gapTo != "number" || typeof json.insert != "number")
      throw new RangeError("Invalid input for ReplaceAroundStep.fromJSON");
    return new _ReplaceAroundStep(json.from, json.to, json.gapFrom, json.gapTo, Slice.fromJSON(schema2, json.slice), json.insert, !!json.structure);
  }
};
Step.jsonID("replaceAround", ReplaceAroundStep);
function contentBetween(doc, from, to) {
  let $from = doc.resolve(from), dist = to - from, depth = $from.depth;
  while (dist > 0 && depth > 0 && $from.indexAfter(depth) == $from.node(depth).childCount) {
    depth--;
    dist--;
  }
  if (dist > 0) {
    let next = $from.node(depth).maybeChild($from.indexAfter(depth));
    while (dist > 0) {
      if (!next || next.isLeaf)
        return true;
      next = next.firstChild;
      dist--;
    }
  }
  return false;
}
function addMark(tr, from, to, mark) {
  let removed = [], added = [];
  let removing, adding;
  tr.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!node.isInline)
      return;
    let marks2 = node.marks;
    if (!mark.isInSet(marks2) && parent.type.allowsMarkType(mark.type)) {
      let start = Math.max(pos, from), end = Math.min(pos + node.nodeSize, to);
      let newSet = mark.addToSet(marks2);
      for (let i = 0; i < marks2.length; i++) {
        if (!marks2[i].isInSet(newSet)) {
          if (removing && removing.to == start && removing.mark.eq(marks2[i]))
            removing.to = end;
          else
            removed.push(removing = new RemoveMarkStep(start, end, marks2[i]));
        }
      }
      if (adding && adding.to == start)
        adding.to = end;
      else
        added.push(adding = new AddMarkStep(start, end, mark));
    }
  });
  removed.forEach((s) => tr.step(s));
  added.forEach((s) => tr.step(s));
}
function removeMark(tr, from, to, mark) {
  let matched = [], step = 0;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline)
      return;
    step++;
    let toRemove = null;
    if (mark instanceof MarkType) {
      let set = node.marks, found2;
      while (found2 = mark.isInSet(set)) {
        (toRemove || (toRemove = [])).push(found2);
        set = found2.removeFromSet(set);
      }
    } else if (mark) {
      if (mark.isInSet(node.marks))
        toRemove = [mark];
    } else {
      toRemove = node.marks;
    }
    if (toRemove && toRemove.length) {
      let end = Math.min(pos + node.nodeSize, to);
      for (let i = 0; i < toRemove.length; i++) {
        let style = toRemove[i], found2;
        for (let j = 0; j < matched.length; j++) {
          let m = matched[j];
          if (m.step == step - 1 && style.eq(matched[j].style))
            found2 = m;
        }
        if (found2) {
          found2.to = end;
          found2.step = step;
        } else {
          matched.push({ style, from: Math.max(pos, from), to: end, step });
        }
      }
    }
  });
  matched.forEach((m) => tr.step(new RemoveMarkStep(m.from, m.to, m.style)));
}
function clearIncompatible(tr, pos, parentType, match = parentType.contentMatch, clearNewlines = true) {
  let node = tr.doc.nodeAt(pos);
  let replSteps = [], cur = pos + 1;
  for (let i = 0; i < node.childCount; i++) {
    let child = node.child(i), end = cur + child.nodeSize;
    let allowed = match.matchType(child.type);
    if (!allowed) {
      replSteps.push(new ReplaceStep(cur, end, Slice.empty));
    } else {
      match = allowed;
      for (let j = 0; j < child.marks.length; j++)
        if (!parentType.allowsMarkType(child.marks[j].type))
          tr.step(new RemoveMarkStep(cur, end, child.marks[j]));
      if (clearNewlines && child.isText && parentType.whitespace != "pre") {
        let m, newline = /\r?\n|\r/g, slice;
        while (m = newline.exec(child.text)) {
          if (!slice)
            slice = new Slice(Fragment.from(parentType.schema.text(" ", parentType.allowedMarks(child.marks))), 0, 0);
          replSteps.push(new ReplaceStep(cur + m.index, cur + m.index + m[0].length, slice));
        }
      }
    }
    cur = end;
  }
  if (!match.validEnd) {
    let fill = match.fillBefore(Fragment.empty, true);
    tr.replace(cur, cur, new Slice(fill, 0, 0));
  }
  for (let i = replSteps.length - 1; i >= 0; i--)
    tr.step(replSteps[i]);
}
function lift(tr, range, target) {
  let { $from, $to, depth } = range;
  let gapStart = $from.before(depth + 1), gapEnd = $to.after(depth + 1);
  let start = gapStart, end = gapEnd;
  let before = Fragment.empty, openStart = 0;
  for (let d = depth, splitting = false; d > target; d--)
    if (splitting || $from.index(d) > 0) {
      splitting = true;
      before = Fragment.from($from.node(d).copy(before));
      openStart++;
    } else {
      start--;
    }
  let after = Fragment.empty, openEnd = 0;
  for (let d = depth, splitting = false; d > target; d--)
    if (splitting || $to.after(d + 1) < $to.end(d)) {
      splitting = true;
      after = Fragment.from($to.node(d).copy(after));
      openEnd++;
    } else {
      end++;
    }
  tr.step(new ReplaceAroundStep(start, end, gapStart, gapEnd, new Slice(before.append(after), openStart, openEnd), before.size - openStart, true));
}
function wrap(tr, range, wrappers) {
  let content = Fragment.empty;
  for (let i = wrappers.length - 1; i >= 0; i--) {
    if (content.size) {
      let match = wrappers[i].type.contentMatch.matchFragment(content);
      if (!match || !match.validEnd)
        throw new RangeError("Wrapper type given to Transform.wrap does not form valid content of its parent wrapper");
    }
    content = Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content));
  }
  let start = range.start, end = range.end;
  tr.step(new ReplaceAroundStep(start, end, start, end, new Slice(content, 0, 0), wrappers.length, true));
}
function setBlockType(tr, from, to, type, attrs2) {
  if (!type.isTextblock)
    throw new RangeError("Type given to setBlockType should be a textblock");
  let mapFrom = tr.steps.length;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    let attrsHere = typeof attrs2 == "function" ? attrs2(node) : attrs2;
    if (node.isTextblock && !node.hasMarkup(type, attrsHere) && canChangeType(tr.doc, tr.mapping.slice(mapFrom).map(pos), type)) {
      let convertNewlines = null;
      if (type.schema.linebreakReplacement) {
        let pre = type.whitespace == "pre", supportLinebreak = !!type.contentMatch.matchType(type.schema.linebreakReplacement);
        if (pre && !supportLinebreak)
          convertNewlines = false;
        else if (!pre && supportLinebreak)
          convertNewlines = true;
      }
      if (convertNewlines === false)
        replaceLinebreaks(tr, node, pos, mapFrom);
      clearIncompatible(tr, tr.mapping.slice(mapFrom).map(pos, 1), type, void 0, convertNewlines === null);
      let mapping = tr.mapping.slice(mapFrom);
      let startM = mapping.map(pos, 1), endM = mapping.map(pos + node.nodeSize, 1);
      tr.step(new ReplaceAroundStep(startM, endM, startM + 1, endM - 1, new Slice(Fragment.from(type.create(attrsHere, null, node.marks)), 0, 0), 1, true));
      if (convertNewlines === true)
        replaceNewlines(tr, node, pos, mapFrom);
      return false;
    }
  });
}
function replaceNewlines(tr, node, pos, mapFrom) {
  node.forEach((child, offset) => {
    if (child.isText) {
      let m, newline = /\r?\n|\r/g;
      while (m = newline.exec(child.text)) {
        let start = tr.mapping.slice(mapFrom).map(pos + 1 + offset + m.index);
        tr.replaceWith(start, start + 1, node.type.schema.linebreakReplacement.create());
      }
    }
  });
}
function replaceLinebreaks(tr, node, pos, mapFrom) {
  node.forEach((child, offset) => {
    if (child.type == child.type.schema.linebreakReplacement) {
      let start = tr.mapping.slice(mapFrom).map(pos + 1 + offset);
      tr.replaceWith(start, start + 1, node.type.schema.text("\n"));
    }
  });
}
function canChangeType(doc, pos, type) {
  let $pos = doc.resolve(pos), index = $pos.index();
  return $pos.parent.canReplaceWith(index, index + 1, type);
}
function setNodeMarkup(tr, pos, type, attrs2, marks2) {
  let node = tr.doc.nodeAt(pos);
  if (!node)
    throw new RangeError("No node at given position");
  if (!type)
    type = node.type;
  let newNode = type.create(attrs2, null, marks2 || node.marks);
  if (node.isLeaf)
    return tr.replaceWith(pos, pos + node.nodeSize, newNode);
  if (!type.validContent(node.content))
    throw new RangeError("Invalid content for node type " + type.name);
  tr.step(new ReplaceAroundStep(pos, pos + node.nodeSize, pos + 1, pos + node.nodeSize - 1, new Slice(Fragment.from(newNode), 0, 0), 1, true));
}
function split(tr, pos, depth = 1, typesAfter) {
  let $pos = tr.doc.resolve(pos), before = Fragment.empty, after = Fragment.empty;
  for (let d = $pos.depth, e = $pos.depth - depth, i = depth - 1; d > e; d--, i--) {
    before = Fragment.from($pos.node(d).copy(before));
    let typeAfter = typesAfter && typesAfter[i];
    after = Fragment.from(typeAfter ? typeAfter.type.create(typeAfter.attrs, after) : $pos.node(d).copy(after));
  }
  tr.step(new ReplaceStep(pos, pos, new Slice(before.append(after), depth, depth), true));
}
function join(tr, pos, depth) {
  let convertNewlines = null;
  let { linebreakReplacement } = tr.doc.type.schema;
  let $before = tr.doc.resolve(pos - depth), beforeType = $before.node().type;
  if (linebreakReplacement && beforeType.inlineContent) {
    let pre = beforeType.whitespace == "pre";
    let supportLinebreak = !!beforeType.contentMatch.matchType(linebreakReplacement);
    if (pre && !supportLinebreak)
      convertNewlines = false;
    else if (!pre && supportLinebreak)
      convertNewlines = true;
  }
  let mapFrom = tr.steps.length;
  if (convertNewlines === false) {
    let $after = tr.doc.resolve(pos + depth);
    replaceLinebreaks(tr, $after.node(), $after.before(), mapFrom);
  }
  if (beforeType.inlineContent)
    clearIncompatible(tr, pos + depth - 1, beforeType, $before.node().contentMatchAt($before.index()), convertNewlines == null);
  let mapping = tr.mapping.slice(mapFrom), start = mapping.map(pos - depth);
  tr.step(new ReplaceStep(start, mapping.map(pos + depth, -1), Slice.empty, true));
  if (convertNewlines === true) {
    let $full = tr.doc.resolve(start);
    replaceNewlines(tr, $full.node(), $full.before(), tr.steps.length);
  }
  return tr;
}
function insertPoint(doc, pos, nodeType) {
  let $pos = doc.resolve(pos);
  if ($pos.parent.canReplaceWith($pos.index(), $pos.index(), nodeType))
    return pos;
  if ($pos.parentOffset == 0)
    for (let d = $pos.depth - 1; d >= 0; d--) {
      let index = $pos.index(d);
      if ($pos.node(d).canReplaceWith(index, index, nodeType))
        return $pos.before(d + 1);
      if (index > 0)
        return null;
    }
  if ($pos.parentOffset == $pos.parent.content.size)
    for (let d = $pos.depth - 1; d >= 0; d--) {
      let index = $pos.indexAfter(d);
      if ($pos.node(d).canReplaceWith(index, index, nodeType))
        return $pos.after(d + 1);
      if (index < $pos.node(d).childCount)
        return null;
    }
  return null;
}
function replaceStep(doc, from, to = from, slice = Slice.empty) {
  if (from == to && !slice.size)
    return null;
  let $from = doc.resolve(from), $to = doc.resolve(to);
  if (fitsTrivially($from, $to, slice))
    return new ReplaceStep(from, to, slice);
  return new Fitter($from, $to, slice).fit();
}
function fitsTrivially($from, $to, slice) {
  return !slice.openStart && !slice.openEnd && $from.start() == $to.start() && $from.parent.canReplace($from.index(), $to.index(), slice.content);
}
var Fitter = class {
  constructor($from, $to, unplaced) {
    this.$from = $from;
    this.$to = $to;
    this.unplaced = unplaced;
    this.frontier = [];
    this.placed = Fragment.empty;
    for (let i = 0; i <= $from.depth; i++) {
      let node = $from.node(i);
      this.frontier.push({
        type: node.type,
        match: node.contentMatchAt($from.indexAfter(i))
      });
    }
    for (let i = $from.depth; i > 0; i--)
      this.placed = Fragment.from($from.node(i).copy(this.placed));
  }
  get depth() {
    return this.frontier.length - 1;
  }
  fit() {
    while (this.unplaced.size) {
      let fit = this.findFittable();
      if (fit)
        this.placeNodes(fit);
      else
        this.openMore() || this.dropNode();
    }
    let moveInline = this.mustMoveInline(), placedSize = this.placed.size - this.depth - this.$from.depth;
    let $from = this.$from, $to = this.close(moveInline < 0 ? this.$to : $from.doc.resolve(moveInline));
    if (!$to)
      return null;
    let content = this.placed, openStart = $from.depth, openEnd = $to.depth;
    while (openStart && openEnd && content.childCount == 1) {
      content = content.firstChild.content;
      openStart--;
      openEnd--;
    }
    let slice = new Slice(content, openStart, openEnd);
    if (moveInline > -1)
      return new ReplaceAroundStep($from.pos, moveInline, this.$to.pos, this.$to.end(), slice, placedSize);
    if (slice.size || $from.pos != this.$to.pos)
      return new ReplaceStep($from.pos, $to.pos, slice);
    return null;
  }
  // Find a position on the start spine of `this.unplaced` that has
  // content that can be moved somewhere on the frontier. Returns two
  // depths, one for the slice and one for the frontier.
  findFittable() {
    let startDepth = this.unplaced.openStart;
    for (let cur = this.unplaced.content, d = 0, openEnd = this.unplaced.openEnd; d < startDepth; d++) {
      let node = cur.firstChild;
      if (cur.childCount > 1)
        openEnd = 0;
      if (node.type.spec.isolating && openEnd <= d) {
        startDepth = d;
        break;
      }
      cur = node.content;
    }
    for (let pass = 1; pass <= 2; pass++) {
      for (let sliceDepth = pass == 1 ? startDepth : this.unplaced.openStart; sliceDepth >= 0; sliceDepth--) {
        let fragment, parent = null;
        if (sliceDepth) {
          parent = contentAt(this.unplaced.content, sliceDepth - 1).firstChild;
          fragment = parent.content;
        } else {
          fragment = this.unplaced.content;
        }
        let first = fragment.firstChild;
        for (let frontierDepth = this.depth; frontierDepth >= 0; frontierDepth--) {
          let { type, match } = this.frontier[frontierDepth], wrap2, inject = null;
          if (pass == 1 && (first ? match.matchType(first.type) || (inject = match.fillBefore(Fragment.from(first), false)) : parent && type.compatibleContent(parent.type)))
            return { sliceDepth, frontierDepth, parent, inject };
          else if (pass == 2 && first && (wrap2 = match.findWrapping(first.type)))
            return { sliceDepth, frontierDepth, parent, wrap: wrap2 };
          if (parent && match.matchType(parent.type))
            break;
        }
      }
    }
  }
  openMore() {
    let { content, openStart, openEnd } = this.unplaced;
    let inner = contentAt(content, openStart);
    if (!inner.childCount || inner.firstChild.isLeaf)
      return false;
    this.unplaced = new Slice(content, openStart + 1, Math.max(openEnd, inner.size + openStart >= content.size - openEnd ? openStart + 1 : 0));
    return true;
  }
  dropNode() {
    let { content, openStart, openEnd } = this.unplaced;
    let inner = contentAt(content, openStart);
    if (inner.childCount <= 1 && openStart > 0) {
      let openAtEnd = content.size - openStart <= openStart + inner.size;
      this.unplaced = new Slice(dropFromFragment(content, openStart - 1, 1), openStart - 1, openAtEnd ? openStart - 1 : openEnd);
    } else {
      this.unplaced = new Slice(dropFromFragment(content, openStart, 1), openStart, openEnd);
    }
  }
  // Move content from the unplaced slice at `sliceDepth` to the
  // frontier node at `frontierDepth`. Close that frontier node when
  // applicable.
  placeNodes({ sliceDepth, frontierDepth, parent, inject, wrap: wrap2 }) {
    while (this.depth > frontierDepth)
      this.closeFrontierNode();
    if (wrap2)
      for (let i = 0; i < wrap2.length; i++)
        this.openFrontierNode(wrap2[i]);
    let slice = this.unplaced, fragment = parent ? parent.content : slice.content;
    let openStart = slice.openStart - sliceDepth;
    let taken = 0, add = [];
    let { match, type } = this.frontier[frontierDepth];
    if (inject) {
      for (let i = 0; i < inject.childCount; i++)
        add.push(inject.child(i));
      match = match.matchFragment(inject);
    }
    let openEndCount = fragment.size + sliceDepth - (slice.content.size - slice.openEnd);
    while (taken < fragment.childCount) {
      let next = fragment.child(taken), matches = match.matchType(next.type);
      if (!matches)
        break;
      taken++;
      if (taken > 1 || openStart == 0 || next.content.size) {
        match = matches;
        add.push(closeNodeStart(next.mark(type.allowedMarks(next.marks)), taken == 1 ? openStart : 0, taken == fragment.childCount ? openEndCount : -1));
      }
    }
    let toEnd = taken == fragment.childCount;
    if (!toEnd)
      openEndCount = -1;
    this.placed = addToFragment(this.placed, frontierDepth, Fragment.from(add));
    this.frontier[frontierDepth].match = match;
    if (toEnd && openEndCount < 0 && parent && parent.type == this.frontier[this.depth].type && this.frontier.length > 1)
      this.closeFrontierNode();
    for (let i = 0, cur = fragment; i < openEndCount; i++) {
      let node = cur.lastChild;
      this.frontier.push({ type: node.type, match: node.contentMatchAt(node.childCount) });
      cur = node.content;
    }
    this.unplaced = !toEnd ? new Slice(dropFromFragment(slice.content, sliceDepth, taken), slice.openStart, slice.openEnd) : sliceDepth == 0 ? Slice.empty : new Slice(dropFromFragment(slice.content, sliceDepth - 1, 1), sliceDepth - 1, openEndCount < 0 ? slice.openEnd : sliceDepth - 1);
  }
  mustMoveInline() {
    if (!this.$to.parent.isTextblock)
      return -1;
    let top = this.frontier[this.depth], level;
    if (!top.type.isTextblock || !contentAfterFits(this.$to, this.$to.depth, top.type, top.match, false) || this.$to.depth == this.depth && (level = this.findCloseLevel(this.$to)) && level.depth == this.depth)
      return -1;
    let { depth } = this.$to, after = this.$to.after(depth);
    while (depth > 1 && after == this.$to.end(--depth))
      ++after;
    return after;
  }
  findCloseLevel($to) {
    scan: for (let i = Math.min(this.depth, $to.depth); i >= 0; i--) {
      let { match, type } = this.frontier[i];
      let dropInner = i < $to.depth && $to.end(i + 1) == $to.pos + ($to.depth - (i + 1));
      let fit = contentAfterFits($to, i, type, match, dropInner);
      if (!fit)
        continue;
      for (let d = i - 1; d >= 0; d--) {
        let { match: match2, type: type2 } = this.frontier[d];
        let matches = contentAfterFits($to, d, type2, match2, true);
        if (!matches || matches.childCount)
          continue scan;
      }
      return { depth: i, fit, move: dropInner ? $to.doc.resolve($to.after(i + 1)) : $to };
    }
  }
  close($to) {
    let close2 = this.findCloseLevel($to);
    if (!close2)
      return null;
    while (this.depth > close2.depth)
      this.closeFrontierNode();
    if (close2.fit.childCount)
      this.placed = addToFragment(this.placed, close2.depth, close2.fit);
    $to = close2.move;
    for (let d = close2.depth + 1; d <= $to.depth; d++) {
      let node = $to.node(d), add = node.type.contentMatch.fillBefore(node.content, true, $to.index(d));
      this.openFrontierNode(node.type, node.attrs, add);
    }
    return $to;
  }
  openFrontierNode(type, attrs2 = null, content) {
    let top = this.frontier[this.depth];
    top.match = top.match.matchType(type);
    this.placed = addToFragment(this.placed, this.depth, Fragment.from(type.create(attrs2, content)));
    this.frontier.push({ type, match: type.contentMatch });
  }
  closeFrontierNode() {
    let open = this.frontier.pop();
    let add = open.match.fillBefore(Fragment.empty, true);
    if (add.childCount)
      this.placed = addToFragment(this.placed, this.frontier.length, add);
  }
};
function dropFromFragment(fragment, depth, count) {
  if (depth == 0)
    return fragment.cutByIndex(count, fragment.childCount);
  return fragment.replaceChild(0, fragment.firstChild.copy(dropFromFragment(fragment.firstChild.content, depth - 1, count)));
}
function addToFragment(fragment, depth, content) {
  if (depth == 0)
    return fragment.append(content);
  return fragment.replaceChild(fragment.childCount - 1, fragment.lastChild.copy(addToFragment(fragment.lastChild.content, depth - 1, content)));
}
function contentAt(fragment, depth) {
  for (let i = 0; i < depth; i++)
    fragment = fragment.firstChild.content;
  return fragment;
}
function closeNodeStart(node, openStart, openEnd) {
  if (openStart <= 0)
    return node;
  let frag = node.content;
  if (openStart > 1)
    frag = frag.replaceChild(0, closeNodeStart(frag.firstChild, openStart - 1, frag.childCount == 1 ? openEnd - 1 : 0));
  if (openStart > 0) {
    frag = node.type.contentMatch.fillBefore(frag).append(frag);
    if (openEnd <= 0)
      frag = frag.append(node.type.contentMatch.matchFragment(frag).fillBefore(Fragment.empty, true));
  }
  return node.copy(frag);
}
function contentAfterFits($to, depth, type, match, open) {
  let node = $to.node(depth), index = open ? $to.indexAfter(depth) : $to.index(depth);
  if (index == node.childCount && !type.compatibleContent(node.type))
    return null;
  let fit = match.fillBefore(node.content, true, index);
  return fit && !invalidMarks(type, node.content, index) ? fit : null;
}
function invalidMarks(type, fragment, start) {
  for (let i = start; i < fragment.childCount; i++)
    if (!type.allowsMarks(fragment.child(i).marks))
      return true;
  return false;
}
function definesContent(type) {
  return type.spec.defining || type.spec.definingForContent;
}
function replaceRange(tr, from, to, slice) {
  if (!slice.size)
    return tr.deleteRange(from, to);
  let $from = tr.doc.resolve(from), $to = tr.doc.resolve(to);
  if (fitsTrivially($from, $to, slice))
    return tr.step(new ReplaceStep(from, to, slice));
  let targetDepths = coveredDepths($from, $to);
  if (targetDepths[targetDepths.length - 1] == 0)
    targetDepths.pop();
  let preferredTarget = -($from.depth + 1);
  targetDepths.unshift(preferredTarget);
  for (let d = $from.depth, pos = $from.pos - 1; d > 0; d--, pos--) {
    let spec = $from.node(d).type.spec;
    if (spec.defining || spec.definingAsContext || spec.isolating)
      break;
    if (targetDepths.indexOf(d) > -1)
      preferredTarget = d;
    else if ($from.before(d) == pos)
      targetDepths.splice(1, 0, -d);
  }
  let preferredTargetIndex = targetDepths.indexOf(preferredTarget);
  let leftNodes = [], preferredDepth = slice.openStart;
  for (let content = slice.content, i = 0; ; i++) {
    let node = content.firstChild;
    leftNodes.push(node);
    if (i == slice.openStart)
      break;
    content = node.content;
  }
  for (let d = preferredDepth - 1; d >= 0; d--) {
    let leftNode = leftNodes[d], def = definesContent(leftNode.type);
    if (def && !leftNode.sameMarkup($from.node(Math.abs(preferredTarget) - 1)))
      preferredDepth = d;
    else if (def || !leftNode.type.isTextblock)
      break;
  }
  for (let j = slice.openStart; j >= 0; j--) {
    let openDepth = (j + preferredDepth + 1) % (slice.openStart + 1);
    let insert = leftNodes[openDepth];
    if (!insert)
      continue;
    for (let i = 0; i < targetDepths.length; i++) {
      let targetDepth = targetDepths[(i + preferredTargetIndex) % targetDepths.length], expand = true;
      if (targetDepth < 0) {
        expand = false;
        targetDepth = -targetDepth;
      }
      let parent = $from.node(targetDepth - 1), index = $from.index(targetDepth - 1);
      if (parent.canReplaceWith(index, index, insert.type, insert.marks))
        return tr.replace($from.before(targetDepth), expand ? $to.after(targetDepth) : to, new Slice(closeFragment(slice.content, 0, slice.openStart, openDepth), openDepth, slice.openEnd));
    }
  }
  let startSteps = tr.steps.length;
  for (let i = targetDepths.length - 1; i >= 0; i--) {
    tr.replace(from, to, slice);
    if (tr.steps.length > startSteps)
      break;
    let depth = targetDepths[i];
    if (depth < 0)
      continue;
    from = $from.before(depth);
    to = $to.after(depth);
  }
}
function closeFragment(fragment, depth, oldOpen, newOpen, parent) {
  if (depth < oldOpen) {
    let first = fragment.firstChild;
    fragment = fragment.replaceChild(0, first.copy(closeFragment(first.content, depth + 1, oldOpen, newOpen, first)));
  }
  if (depth > newOpen) {
    let match = parent.contentMatchAt(0);
    let start = match.fillBefore(fragment).append(fragment);
    fragment = start.append(match.matchFragment(start).fillBefore(Fragment.empty, true));
  }
  return fragment;
}
function replaceRangeWith(tr, from, to, node) {
  if (!node.isInline && from == to && tr.doc.resolve(from).parent.content.size) {
    let point = insertPoint(tr.doc, from, node.type);
    if (point != null)
      from = to = point;
  }
  tr.replaceRange(from, to, new Slice(Fragment.from(node), 0, 0));
}
function deleteRange(tr, from, to) {
  let $from = tr.doc.resolve(from), $to = tr.doc.resolve(to);
  if ($from.parent.isTextblock && $to.parent.isTextblock && $from.start() != $to.start() && $from.parentOffset == 0 && $to.parentOffset == 0) {
    let shared = $from.sharedDepth(to), isolated = false;
    for (let d = $from.depth; d > shared; d--)
      if ($from.node(d).type.spec.isolating)
        isolated = true;
    for (let d = $to.depth; d > shared; d--)
      if ($to.node(d).type.spec.isolating)
        isolated = true;
    if (!isolated) {
      for (let d = $from.depth; d > 0 && from == $from.start(d); d--)
        from = $from.before(d);
      for (let d = $to.depth; d > 0 && to == $to.start(d); d--)
        to = $to.before(d);
      $from = tr.doc.resolve(from);
      $to = tr.doc.resolve(to);
    }
  }
  let covered = coveredDepths($from, $to);
  for (let i = 0; i < covered.length; i++) {
    let depth = covered[i], last = i == covered.length - 1;
    if (last && depth == 0 || $from.node(depth).type.contentMatch.validEnd)
      return tr.delete($from.start(depth), $to.end(depth));
    if (depth > 0 && (last || $from.node(depth - 1).canReplace($from.index(depth - 1), $to.indexAfter(depth - 1))))
      return tr.delete($from.before(depth), $to.after(depth));
  }
  for (let d = 1; d <= $from.depth && d <= $to.depth; d++) {
    if (from - $from.start(d) == $from.depth - d && to > $from.end(d) && $to.end(d) - to != $to.depth - d && $from.start(d - 1) == $to.start(d - 1) && $from.node(d - 1).canReplace($from.index(d - 1), $to.index(d - 1)))
      return tr.delete($from.before(d), to);
  }
  tr.delete(from, to);
}
function coveredDepths($from, $to) {
  let result = [], minDepth = Math.min($from.depth, $to.depth);
  for (let d = minDepth; d >= 0; d--) {
    let start = $from.start(d);
    if (start < $from.pos - ($from.depth - d) || $to.end(d) > $to.pos + ($to.depth - d) || $from.node(d).type.spec.isolating || $to.node(d).type.spec.isolating)
      break;
    if (start == $to.start(d) || d == $from.depth && d == $to.depth && $from.parent.inlineContent && $to.parent.inlineContent && d && $to.start(d - 1) == start - 1)
      result.push(d);
  }
  return result;
}
var AttrStep = class _AttrStep extends Step {
  /**
  Construct an attribute step.
  */
  constructor(pos, attr, value) {
    super();
    this.pos = pos;
    this.attr = attr;
    this.value = value;
  }
  apply(doc) {
    let node = doc.nodeAt(this.pos);
    if (!node)
      return StepResult.fail("No node at attribute step's position");
    let attrs2 = /* @__PURE__ */ Object.create(null);
    for (let name in node.attrs)
      attrs2[name] = node.attrs[name];
    attrs2[this.attr] = this.value;
    let updated = node.type.create(attrs2, null, node.marks);
    return StepResult.fromReplace(doc, this.pos, this.pos + 1, new Slice(Fragment.from(updated), 0, node.isLeaf ? 0 : 1));
  }
  getMap() {
    return StepMap.empty;
  }
  invert(doc) {
    return new _AttrStep(this.pos, this.attr, doc.nodeAt(this.pos).attrs[this.attr]);
  }
  map(mapping) {
    let pos = mapping.mapResult(this.pos, 1);
    return pos.deletedAfter ? null : new _AttrStep(pos.pos, this.attr, this.value);
  }
  toJSON() {
    return { stepType: "attr", pos: this.pos, attr: this.attr, value: this.value };
  }
  static fromJSON(schema2, json) {
    if (typeof json.pos != "number" || typeof json.attr != "string")
      throw new RangeError("Invalid input for AttrStep.fromJSON");
    return new _AttrStep(json.pos, json.attr, json.value);
  }
};
Step.jsonID("attr", AttrStep);
var DocAttrStep = class _DocAttrStep extends Step {
  /**
  Construct an attribute step.
  */
  constructor(attr, value) {
    super();
    this.attr = attr;
    this.value = value;
  }
  apply(doc) {
    let attrs2 = /* @__PURE__ */ Object.create(null);
    for (let name in doc.attrs)
      attrs2[name] = doc.attrs[name];
    attrs2[this.attr] = this.value;
    let updated = doc.type.create(attrs2, doc.content, doc.marks);
    return StepResult.ok(updated);
  }
  getMap() {
    return StepMap.empty;
  }
  invert(doc) {
    return new _DocAttrStep(this.attr, doc.attrs[this.attr]);
  }
  map(mapping) {
    return this;
  }
  toJSON() {
    return { stepType: "docAttr", attr: this.attr, value: this.value };
  }
  static fromJSON(schema2, json) {
    if (typeof json.attr != "string")
      throw new RangeError("Invalid input for DocAttrStep.fromJSON");
    return new _DocAttrStep(json.attr, json.value);
  }
};
Step.jsonID("docAttr", DocAttrStep);
var TransformError = class extends Error {
};
TransformError = function TransformError2(message) {
  let err3 = Error.call(this, message);
  err3.__proto__ = TransformError2.prototype;
  return err3;
};
TransformError.prototype = Object.create(Error.prototype);
TransformError.prototype.constructor = TransformError;
TransformError.prototype.name = "TransformError";
var Transform = class {
  /**
  Create a transform that starts with the given document.
  */
  constructor(doc) {
    this.doc = doc;
    this.steps = [];
    this.docs = [];
    this.mapping = new Mapping();
  }
  /**
  The starting document.
  */
  get before() {
    return this.docs.length ? this.docs[0] : this.doc;
  }
  /**
  Apply a new step in this transform, saving the result. Throws an
  error when the step fails.
  */
  step(step) {
    let result = this.maybeStep(step);
    if (result.failed)
      throw new TransformError(result.failed);
    return this;
  }
  /**
  Try to apply a step in this transformation, ignoring it if it
  fails. Returns the step result.
  */
  maybeStep(step) {
    let result = step.apply(this.doc);
    if (!result.failed)
      this.addStep(step, result.doc);
    return result;
  }
  /**
  True when the document has been changed (when there are any
  steps).
  */
  get docChanged() {
    return this.steps.length > 0;
  }
  /**
  Return a single range, in post-transform document positions,
  that covers all content changed by this transform. Returns null
  if no replacements are made. Note that this will ignore changes
  that add/remove marks without replacing the underlying content.
  */
  changedRange() {
    let from = 1e9, to = -1e9;
    for (let i = 0; i < this.mapping.maps.length; i++) {
      let map = this.mapping.maps[i];
      if (i) {
        from = map.map(from, 1);
        to = map.map(to, -1);
      }
      map.forEach((_f, _t, fromB, toB) => {
        from = Math.min(from, fromB);
        to = Math.max(to, toB);
      });
    }
    return from == 1e9 ? null : { from, to };
  }
  /**
  @internal
  */
  addStep(step, doc) {
    this.docs.push(this.doc);
    this.steps.push(step);
    this.mapping.appendMap(step.getMap());
    this.doc = doc;
  }
  /**
  Replace the part of the document between `from` and `to` with the
  given `slice`.
  */
  replace(from, to = from, slice = Slice.empty) {
    let step = replaceStep(this.doc, from, to, slice);
    if (step)
      this.step(step);
    return this;
  }
  /**
  Replace the given range with the given content, which may be a
  fragment, node, or array of nodes.
  */
  replaceWith(from, to, content) {
    return this.replace(from, to, new Slice(Fragment.from(content), 0, 0));
  }
  /**
  Delete the content between the given positions.
  */
  delete(from, to) {
    return this.replace(from, to, Slice.empty);
  }
  /**
  Insert the given content at the given position.
  */
  insert(pos, content) {
    return this.replaceWith(pos, pos, content);
  }
  /**
  Replace a range of the document with a given slice, using
  `from`, `to`, and the slice's
  [`openStart`](https://prosemirror.net/docs/ref/#model.Slice.openStart) property as hints, rather
  than fixed start and end points. This method may grow the
  replaced area or close open nodes in the slice in order to get a
  fit that is more in line with WYSIWYG expectations, by dropping
  fully covered parent nodes of the replaced region when they are
  marked [non-defining as
  context](https://prosemirror.net/docs/ref/#model.NodeSpec.definingAsContext), or including an
  open parent node from the slice that _is_ marked as [defining
  its content](https://prosemirror.net/docs/ref/#model.NodeSpec.definingForContent).
  
  This is the method, for example, to handle paste. The similar
  [`replace`](https://prosemirror.net/docs/ref/#transform.Transform.replace) method is a more
  primitive tool which will _not_ move the start and end of its given
  range, and is useful in situations where you need more precise
  control over what happens.
  */
  replaceRange(from, to, slice) {
    replaceRange(this, from, to, slice);
    return this;
  }
  /**
  Replace the given range with a node, but use `from` and `to` as
  hints, rather than precise positions. When from and to are the same
  and are at the start or end of a parent node in which the given
  node doesn't fit, this method may _move_ them out towards a parent
  that does allow the given node to be placed. When the given range
  completely covers a parent node, this method may completely replace
  that parent node.
  */
  replaceRangeWith(from, to, node) {
    replaceRangeWith(this, from, to, node);
    return this;
  }
  /**
  Delete the given range, expanding it to cover fully covered
  parent nodes until a valid replace is found.
  */
  deleteRange(from, to) {
    deleteRange(this, from, to);
    return this;
  }
  /**
  Split the content in the given range off from its parent, if there
  is sibling content before or after it, and move it up the tree to
  the depth specified by `target`. You'll probably want to use
  [`liftTarget`](https://prosemirror.net/docs/ref/#transform.liftTarget) to compute `target`, to make
  sure the lift is valid.
  */
  lift(range, target) {
    lift(this, range, target);
    return this;
  }
  /**
  Join the blocks around the given position. If depth is 2, their
  last and first siblings are also joined, and so on.
  */
  join(pos, depth = 1) {
    join(this, pos, depth);
    return this;
  }
  /**
  Wrap the given [range](https://prosemirror.net/docs/ref/#model.NodeRange) in the given set of wrappers.
  The wrappers are assumed to be valid in this position, and should
  probably be computed with [`findWrapping`](https://prosemirror.net/docs/ref/#transform.findWrapping).
  */
  wrap(range, wrappers) {
    wrap(this, range, wrappers);
    return this;
  }
  /**
  Set the type of all textblocks (partly) between `from` and `to` to
  the given node type with the given attributes.
  */
  setBlockType(from, to = from, type, attrs2 = null) {
    setBlockType(this, from, to, type, attrs2);
    return this;
  }
  /**
  Change the type, attributes, and/or marks of the node at `pos`.
  When `type` isn't given, the existing node type is preserved,
  */
  setNodeMarkup(pos, type, attrs2 = null, marks2) {
    setNodeMarkup(this, pos, type, attrs2, marks2);
    return this;
  }
  /**
  Set a single attribute on a given node to a new value.
  The `pos` addresses the document content. Use `setDocAttribute`
  to set attributes on the document itself.
  */
  setNodeAttribute(pos, attr, value) {
    this.step(new AttrStep(pos, attr, value));
    return this;
  }
  /**
  Set a single attribute on the document to a new value.
  */
  setDocAttribute(attr, value) {
    this.step(new DocAttrStep(attr, value));
    return this;
  }
  /**
  Add a mark to the node at position `pos`.
  */
  addNodeMark(pos, mark) {
    this.step(new AddNodeMarkStep(pos, mark));
    return this;
  }
  /**
  Remove a mark (or all marks of the given type) from the node at
  position `pos`.
  */
  removeNodeMark(pos, mark) {
    let node = this.doc.nodeAt(pos);
    if (!node)
      throw new RangeError("No node at position " + pos);
    if (mark instanceof Mark) {
      if (mark.isInSet(node.marks))
        this.step(new RemoveNodeMarkStep(pos, mark));
    } else {
      let set = node.marks, found2, steps = [];
      while (found2 = mark.isInSet(set)) {
        steps.push(new RemoveNodeMarkStep(pos, found2));
        set = found2.removeFromSet(set);
      }
      for (let i = steps.length - 1; i >= 0; i--)
        this.step(steps[i]);
    }
    return this;
  }
  /**
  Split the node at the given position, and optionally, if `depth` is
  greater than one, any number of nodes above that. By default, the
  parts split off will inherit the node type of the original node.
  This can be changed by passing an array of types and attributes to
  use after the split (with the outermost nodes coming first).
  */
  split(pos, depth = 1, typesAfter) {
    split(this, pos, depth, typesAfter);
    return this;
  }
  /**
  Add the given mark to the inline content between `from` and `to`.
  */
  addMark(from, to, mark) {
    addMark(this, from, to, mark);
    return this;
  }
  /**
  Remove marks from inline nodes between `from` and `to`. When
  `mark` is a single mark, remove precisely that mark. When it is
  a mark type, remove all marks of that type. When it is null,
  remove all marks of any type.
  */
  removeMark(from, to, mark) {
    removeMark(this, from, to, mark);
    return this;
  }
  /**
  Removes all marks and nodes from the content of the node at
  `pos` that don't match the given new parent node type. Accepts
  an optional starting [content match](https://prosemirror.net/docs/ref/#model.ContentMatch) as
  third argument.
  */
  clearIncompatible(pos, parentType, match) {
    clearIncompatible(this, pos, parentType, match);
    return this;
  }
};

// node_modules/prosemirror-state/dist/index.js
var classesById = /* @__PURE__ */ Object.create(null);
var Selection = class {
  /**
  Initialize a selection with the head and anchor and ranges. If no
  ranges are given, constructs a single range across `$anchor` and
  `$head`.
  */
  constructor($anchor, $head, ranges) {
    this.$anchor = $anchor;
    this.$head = $head;
    this.ranges = ranges || [new SelectionRange($anchor.min($head), $anchor.max($head))];
  }
  /**
  The selection's anchor, as an unresolved position.
  */
  get anchor() {
    return this.$anchor.pos;
  }
  /**
  The selection's head.
  */
  get head() {
    return this.$head.pos;
  }
  /**
  The lower bound of the selection's main range.
  */
  get from() {
    return this.$from.pos;
  }
  /**
  The upper bound of the selection's main range.
  */
  get to() {
    return this.$to.pos;
  }
  /**
  The resolved lower  bound of the selection's main range.
  */
  get $from() {
    return this.ranges[0].$from;
  }
  /**
  The resolved upper bound of the selection's main range.
  */
  get $to() {
    return this.ranges[0].$to;
  }
  /**
  Indicates whether the selection contains any content.
  */
  get empty() {
    let ranges = this.ranges;
    for (let i = 0; i < ranges.length; i++)
      if (ranges[i].$from.pos != ranges[i].$to.pos)
        return false;
    return true;
  }
  /**
  Get the content of this selection as a slice.
  */
  content() {
    return this.$from.doc.slice(this.from, this.to, true);
  }
  /**
  Replace the selection with a slice or, if no slice is given,
  delete the selection. Will append to the given transaction.
  */
  replace(tr, content = Slice.empty) {
    let lastNode = content.content.lastChild, lastParent = null;
    for (let i = 0; i < content.openEnd; i++) {
      lastParent = lastNode;
      lastNode = lastNode.lastChild;
    }
    let mapFrom = tr.steps.length, ranges = this.ranges;
    for (let i = 0; i < ranges.length; i++) {
      let { $from, $to } = ranges[i], mapping = tr.mapping.slice(mapFrom);
      tr.replaceRange(mapping.map($from.pos), mapping.map($to.pos), i ? Slice.empty : content);
      if (i == 0)
        selectionToInsertionEnd(tr, mapFrom, (lastNode ? lastNode.isInline : lastParent && lastParent.isTextblock) ? -1 : 1);
    }
  }
  /**
  Replace the selection with the given node, appending the changes
  to the given transaction.
  */
  replaceWith(tr, node) {
    let mapFrom = tr.steps.length, ranges = this.ranges;
    for (let i = 0; i < ranges.length; i++) {
      let { $from, $to } = ranges[i], mapping = tr.mapping.slice(mapFrom);
      let from = mapping.map($from.pos), to = mapping.map($to.pos);
      if (i) {
        tr.deleteRange(from, to);
      } else {
        tr.replaceRangeWith(from, to, node);
        selectionToInsertionEnd(tr, mapFrom, node.isInline ? -1 : 1);
      }
    }
  }
  /**
  Find a valid cursor or leaf node selection starting at the given
  position and searching back if `dir` is negative, and forward if
  positive. When `textOnly` is true, only consider cursor
  selections. Will return null when no valid selection position is
  found.
  */
  static findFrom($pos, dir, textOnly = false) {
    let inner = $pos.parent.inlineContent ? new TextSelection($pos) : findSelectionIn($pos.node(0), $pos.parent, $pos.pos, $pos.index(), dir, textOnly);
    if (inner)
      return inner;
    for (let depth = $pos.depth - 1; depth >= 0; depth--) {
      let found2 = dir < 0 ? findSelectionIn($pos.node(0), $pos.node(depth), $pos.before(depth + 1), $pos.index(depth), dir, textOnly) : findSelectionIn($pos.node(0), $pos.node(depth), $pos.after(depth + 1), $pos.index(depth) + 1, dir, textOnly);
      if (found2)
        return found2;
    }
    return null;
  }
  /**
  Find a valid cursor or leaf node selection near the given
  position. Searches forward first by default, but if `bias` is
  negative, it will search backwards first.
  */
  static near($pos, bias = 1) {
    return this.findFrom($pos, bias) || this.findFrom($pos, -bias) || new AllSelection($pos.node(0));
  }
  /**
  Find the cursor or leaf node selection closest to the start of
  the given document. Will return an
  [`AllSelection`](https://prosemirror.net/docs/ref/#state.AllSelection) if no valid position
  exists.
  */
  static atStart(doc) {
    return findSelectionIn(doc, doc, 0, 0, 1) || new AllSelection(doc);
  }
  /**
  Find the cursor or leaf node selection closest to the end of the
  given document.
  */
  static atEnd(doc) {
    return findSelectionIn(doc, doc, doc.content.size, doc.childCount, -1) || new AllSelection(doc);
  }
  /**
  Deserialize the JSON representation of a selection. Must be
  implemented for custom classes (as a static class method).
  */
  static fromJSON(doc, json) {
    if (!json || !json.type)
      throw new RangeError("Invalid input for Selection.fromJSON");
    let cls = classesById[json.type];
    if (!cls)
      throw new RangeError(`No selection type ${json.type} defined`);
    return cls.fromJSON(doc, json);
  }
  /**
  To be able to deserialize selections from JSON, custom selection
  classes must register themselves with an ID string, so that they
  can be disambiguated. Try to pick something that's unlikely to
  clash with classes from other modules.
  */
  static jsonID(id, selectionClass) {
    if (id in classesById)
      throw new RangeError("Duplicate use of selection JSON ID " + id);
    classesById[id] = selectionClass;
    selectionClass.prototype.jsonID = id;
    return selectionClass;
  }
  /**
  Get a [bookmark](https://prosemirror.net/docs/ref/#state.SelectionBookmark) for this selection,
  which is a value that can be mapped without having access to a
  current document, and later resolved to a real selection for a
  given document again. (This is used mostly by the history to
  track and restore old selections.) The default implementation of
  this method just converts the selection to a text selection and
  returns the bookmark for that.
  */
  getBookmark() {
    return TextSelection.between(this.$anchor, this.$head).getBookmark();
  }
};
Selection.prototype.visible = true;
var SelectionRange = class {
  /**
  Create a range.
  */
  constructor($from, $to) {
    this.$from = $from;
    this.$to = $to;
  }
};
var warnedAboutTextSelection = false;
function checkTextSelection($pos) {
  if (!warnedAboutTextSelection && !$pos.parent.inlineContent) {
    warnedAboutTextSelection = true;
    console["warn"]("TextSelection endpoint not pointing into a node with inline content (" + $pos.parent.type.name + ")");
  }
}
var TextSelection = class _TextSelection extends Selection {
  /**
  Construct a text selection between the given points.
  */
  constructor($anchor, $head = $anchor) {
    checkTextSelection($anchor);
    checkTextSelection($head);
    super($anchor, $head);
  }
  /**
  Returns a resolved position if this is a cursor selection (an
  empty text selection), and null otherwise.
  */
  get $cursor() {
    return this.$anchor.pos == this.$head.pos ? this.$head : null;
  }
  map(doc, mapping) {
    let $head = doc.resolve(mapping.map(this.head));
    if (!$head.parent.inlineContent)
      return Selection.near($head);
    let $anchor = doc.resolve(mapping.map(this.anchor));
    return new _TextSelection($anchor.parent.inlineContent ? $anchor : $head, $head);
  }
  replace(tr, content = Slice.empty) {
    super.replace(tr, content);
    if (content == Slice.empty) {
      let marks2 = this.$from.marksAcross(this.$to);
      if (marks2)
        tr.ensureMarks(marks2);
    }
  }
  eq(other) {
    return other instanceof _TextSelection && other.anchor == this.anchor && other.head == this.head;
  }
  getBookmark() {
    return new TextBookmark(this.anchor, this.head);
  }
  toJSON() {
    return { type: "text", anchor: this.anchor, head: this.head };
  }
  /**
  @internal
  */
  static fromJSON(doc, json) {
    if (typeof json.anchor != "number" || typeof json.head != "number")
      throw new RangeError("Invalid input for TextSelection.fromJSON");
    return new _TextSelection(doc.resolve(json.anchor), doc.resolve(json.head));
  }
  /**
  Create a text selection from non-resolved positions.
  */
  static create(doc, anchor, head = anchor) {
    let $anchor = doc.resolve(anchor);
    return new this($anchor, head == anchor ? $anchor : doc.resolve(head));
  }
  /**
  Return a text selection that spans the given positions or, if
  they aren't text positions, find a text selection near them.
  `bias` determines whether the method searches forward (default)
  or backwards (negative number) first. Will fall back to calling
  [`Selection.near`](https://prosemirror.net/docs/ref/#state.Selection^near) when the document
  doesn't contain a valid text position.
  */
  static between($anchor, $head, bias) {
    let dPos = $anchor.pos - $head.pos;
    if (!bias || dPos)
      bias = dPos >= 0 ? 1 : -1;
    if (!$head.parent.inlineContent) {
      let found2 = Selection.findFrom($head, bias, true) || Selection.findFrom($head, -bias, true);
      if (found2)
        $head = found2.$head;
      else
        return Selection.near($head, bias);
    }
    if (!$anchor.parent.inlineContent) {
      if (dPos == 0) {
        $anchor = $head;
      } else {
        $anchor = (Selection.findFrom($anchor, -bias, true) || Selection.findFrom($anchor, bias, true)).$anchor;
        if ($anchor.pos < $head.pos != dPos < 0)
          $anchor = $head;
      }
    }
    return new _TextSelection($anchor, $head);
  }
};
Selection.jsonID("text", TextSelection);
var TextBookmark = class _TextBookmark {
  constructor(anchor, head) {
    this.anchor = anchor;
    this.head = head;
  }
  map(mapping) {
    return new _TextBookmark(mapping.map(this.anchor), mapping.map(this.head));
  }
  resolve(doc) {
    return TextSelection.between(doc.resolve(this.anchor), doc.resolve(this.head));
  }
};
var NodeSelection = class _NodeSelection extends Selection {
  /**
  Create a node selection. Does not verify the validity of its
  argument.
  */
  constructor($pos) {
    let node = $pos.nodeAfter;
    let $end = $pos.node(0).resolve($pos.pos + node.nodeSize);
    super($pos, $end);
    this.node = node;
  }
  map(doc, mapping) {
    let { deleted, pos } = mapping.mapResult(this.anchor);
    let $pos = doc.resolve(pos);
    if (deleted)
      return Selection.near($pos);
    return new _NodeSelection($pos);
  }
  content() {
    return new Slice(Fragment.from(this.node), 0, 0);
  }
  eq(other) {
    return other instanceof _NodeSelection && other.anchor == this.anchor;
  }
  toJSON() {
    return { type: "node", anchor: this.anchor };
  }
  getBookmark() {
    return new NodeBookmark(this.anchor);
  }
  /**
  @internal
  */
  static fromJSON(doc, json) {
    if (typeof json.anchor != "number")
      throw new RangeError("Invalid input for NodeSelection.fromJSON");
    return new _NodeSelection(doc.resolve(json.anchor));
  }
  /**
  Create a node selection from non-resolved positions.
  */
  static create(doc, from) {
    return new _NodeSelection(doc.resolve(from));
  }
  /**
  Determines whether the given node may be selected as a node
  selection.
  */
  static isSelectable(node) {
    return !node.isText && node.type.spec.selectable !== false;
  }
};
NodeSelection.prototype.visible = false;
Selection.jsonID("node", NodeSelection);
var NodeBookmark = class _NodeBookmark {
  constructor(anchor) {
    this.anchor = anchor;
  }
  map(mapping) {
    let { deleted, pos } = mapping.mapResult(this.anchor);
    return deleted ? new TextBookmark(pos, pos) : new _NodeBookmark(pos);
  }
  resolve(doc) {
    let $pos = doc.resolve(this.anchor), node = $pos.nodeAfter;
    if (node && NodeSelection.isSelectable(node))
      return new NodeSelection($pos);
    return Selection.near($pos);
  }
};
var AllSelection = class _AllSelection extends Selection {
  /**
  Create an all-selection over the given document.
  */
  constructor(doc) {
    super(doc.resolve(0), doc.resolve(doc.content.size));
  }
  replace(tr, content = Slice.empty) {
    if (content == Slice.empty) {
      tr.delete(0, tr.doc.content.size);
      let sel = Selection.atStart(tr.doc);
      if (!sel.eq(tr.selection))
        tr.setSelection(sel);
    } else {
      super.replace(tr, content);
    }
  }
  toJSON() {
    return { type: "all" };
  }
  /**
  @internal
  */
  static fromJSON(doc) {
    return new _AllSelection(doc);
  }
  map(doc) {
    return new _AllSelection(doc);
  }
  eq(other) {
    return other instanceof _AllSelection;
  }
  getBookmark() {
    return AllBookmark;
  }
};
Selection.jsonID("all", AllSelection);
var AllBookmark = {
  map() {
    return this;
  },
  resolve(doc) {
    return new AllSelection(doc);
  }
};
function findSelectionIn(doc, node, pos, index, dir, text = false) {
  if (node.inlineContent)
    return TextSelection.create(doc, pos);
  for (let i = index - (dir > 0 ? 0 : 1); dir > 0 ? i < node.childCount : i >= 0; i += dir) {
    let child = node.child(i);
    if (!child.isAtom) {
      let inner = findSelectionIn(doc, child, pos + dir, dir < 0 ? child.childCount : 0, dir, text);
      if (inner)
        return inner;
    } else if (!text && NodeSelection.isSelectable(child)) {
      return NodeSelection.create(doc, pos - (dir < 0 ? child.nodeSize : 0));
    }
    pos += child.nodeSize * dir;
  }
  return null;
}
function selectionToInsertionEnd(tr, startLen, bias) {
  let last = tr.steps.length - 1;
  if (last < startLen)
    return;
  let step = tr.steps[last];
  if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep))
    return;
  let map = tr.mapping.maps[last], end;
  map.forEach((_from, _to, _newFrom, newTo) => {
    if (end == null)
      end = newTo;
  });
  tr.setSelection(Selection.near(tr.doc.resolve(end), bias));
}
var UPDATED_SEL = 1;
var UPDATED_MARKS = 2;
var UPDATED_SCROLL = 4;
var Transaction = class extends Transform {
  /**
  @internal
  */
  constructor(state) {
    super(state.doc);
    this.curSelectionFor = 0;
    this.updated = 0;
    this.meta = /* @__PURE__ */ Object.create(null);
    this.time = Date.now();
    this.curSelection = state.selection;
    this.storedMarks = state.storedMarks;
  }
  /**
  The transaction's current selection. This defaults to the editor
  selection [mapped](https://prosemirror.net/docs/ref/#state.Selection.map) through the steps in the
  transaction, but can be overwritten with
  [`setSelection`](https://prosemirror.net/docs/ref/#state.Transaction.setSelection).
  */
  get selection() {
    if (this.curSelectionFor < this.steps.length) {
      this.curSelection = this.curSelection.map(this.doc, this.mapping.slice(this.curSelectionFor));
      this.curSelectionFor = this.steps.length;
    }
    return this.curSelection;
  }
  /**
  Update the transaction's current selection. Will determine the
  selection that the editor gets when the transaction is applied.
  */
  setSelection(selection) {
    if (selection.$from.doc != this.doc)
      throw new RangeError("Selection passed to setSelection must point at the current document");
    this.curSelection = selection;
    this.curSelectionFor = this.steps.length;
    this.updated = (this.updated | UPDATED_SEL) & ~UPDATED_MARKS;
    this.storedMarks = null;
    return this;
  }
  /**
  Whether the selection was explicitly updated by this transaction.
  */
  get selectionSet() {
    return (this.updated & UPDATED_SEL) > 0;
  }
  /**
  Set the current stored marks.
  */
  setStoredMarks(marks2) {
    this.storedMarks = marks2;
    this.updated |= UPDATED_MARKS;
    return this;
  }
  /**
  Make sure the current stored marks or, if that is null, the marks
  at the selection, match the given set of marks. Does nothing if
  this is already the case.
  */
  ensureMarks(marks2) {
    if (!Mark.sameSet(this.storedMarks || this.selection.$from.marks(), marks2))
      this.setStoredMarks(marks2);
    return this;
  }
  /**
  Add a mark to the set of stored marks.
  */
  addStoredMark(mark) {
    return this.ensureMarks(mark.addToSet(this.storedMarks || this.selection.$head.marks()));
  }
  /**
  Remove a mark or mark type from the set of stored marks.
  */
  removeStoredMark(mark) {
    return this.ensureMarks(mark.removeFromSet(this.storedMarks || this.selection.$head.marks()));
  }
  /**
  Whether the stored marks were explicitly set for this transaction.
  */
  get storedMarksSet() {
    return (this.updated & UPDATED_MARKS) > 0;
  }
  /**
  @internal
  */
  addStep(step, doc) {
    super.addStep(step, doc);
    this.updated = this.updated & ~UPDATED_MARKS;
    this.storedMarks = null;
  }
  /**
  Update the timestamp for the transaction.
  */
  setTime(time) {
    this.time = time;
    return this;
  }
  /**
  Replace the current selection with the given slice.
  */
  replaceSelection(slice) {
    this.selection.replace(this, slice);
    return this;
  }
  /**
  Replace the selection with the given node. When `inheritMarks` is
  true and the content is inline, it inherits the marks from the
  place where it is inserted.
  */
  replaceSelectionWith(node, inheritMarks = true) {
    let selection = this.selection;
    if (inheritMarks)
      node = node.mark(this.storedMarks || (selection.empty ? selection.$from.marks() : selection.$from.marksAcross(selection.$to) || Mark.none));
    selection.replaceWith(this, node);
    return this;
  }
  /**
  Delete the selection.
  */
  deleteSelection() {
    this.selection.replace(this);
    return this;
  }
  /**
  Replace the given range, or the selection if no range is given,
  with a text node containing the given string.
  */
  insertText(text, from, to) {
    let schema2 = this.doc.type.schema;
    if (from == null) {
      if (!text)
        return this.deleteSelection();
      return this.replaceSelectionWith(schema2.text(text), true);
    } else {
      if (to == null)
        to = from;
      if (!text)
        return this.deleteRange(from, to);
      let marks2 = this.storedMarks;
      if (!marks2) {
        let $from = this.doc.resolve(from);
        marks2 = to == from ? $from.marks() : $from.marksAcross(this.doc.resolve(to));
      }
      this.replaceRangeWith(from, to, schema2.text(text, marks2));
      if (!this.selection.empty && this.selection.to == from + text.length)
        this.setSelection(Selection.near(this.selection.$to));
      return this;
    }
  }
  /**
  Store a metadata property in this transaction, keyed either by
  name or by plugin.
  */
  setMeta(key, value) {
    this.meta[typeof key == "string" ? key : key.key] = value;
    return this;
  }
  /**
  Retrieve a metadata property for a given name or plugin.
  */
  getMeta(key) {
    return this.meta[typeof key == "string" ? key : key.key];
  }
  /**
  Returns true if this transaction doesn't contain any metadata,
  and can thus safely be extended.
  */
  get isGeneric() {
    for (let _ in this.meta)
      return false;
    return true;
  }
  /**
  Indicate that the editor should scroll the selection into view
  when updated to the state produced by this transaction.
  */
  scrollIntoView() {
    this.updated |= UPDATED_SCROLL;
    return this;
  }
  /**
  True when this transaction has had `scrollIntoView` called on it.
  */
  get scrolledIntoView() {
    return (this.updated & UPDATED_SCROLL) > 0;
  }
};
function bind(f, self) {
  return !self || !f ? f : f.bind(self);
}
var FieldDesc = class {
  constructor(name, desc, self) {
    this.name = name;
    this.init = bind(desc.init, self);
    this.apply = bind(desc.apply, self);
  }
};
var baseFields = [
  new FieldDesc("doc", {
    init(config) {
      return config.doc || config.schema.topNodeType.createAndFill();
    },
    apply(tr) {
      return tr.doc;
    }
  }),
  new FieldDesc("selection", {
    init(config, instance) {
      return config.selection || Selection.atStart(instance.doc);
    },
    apply(tr) {
      return tr.selection;
    }
  }),
  new FieldDesc("storedMarks", {
    init(config) {
      return config.storedMarks || null;
    },
    apply(tr, _marks, _old, state) {
      return state.selection.$cursor ? tr.storedMarks : null;
    }
  }),
  new FieldDesc("scrollToSelection", {
    init() {
      return 0;
    },
    apply(tr, prev) {
      return tr.scrolledIntoView ? prev + 1 : prev;
    }
  })
];
var Configuration = class {
  constructor(schema2, plugins) {
    this.schema = schema2;
    this.plugins = [];
    this.pluginsByKey = /* @__PURE__ */ Object.create(null);
    this.fields = baseFields.slice();
    if (plugins)
      plugins.forEach((plugin) => {
        if (this.pluginsByKey[plugin.key])
          throw new RangeError("Adding different instances of a keyed plugin (" + plugin.key + ")");
        this.plugins.push(plugin);
        this.pluginsByKey[plugin.key] = plugin;
        if (plugin.spec.state)
          this.fields.push(new FieldDesc(plugin.key, plugin.spec.state, plugin));
      });
  }
};
var EditorState = class _EditorState {
  /**
  @internal
  */
  constructor(config) {
    this.config = config;
  }
  /**
  The schema of the state's document.
  */
  get schema() {
    return this.config.schema;
  }
  /**
  The plugins that are active in this state.
  */
  get plugins() {
    return this.config.plugins;
  }
  /**
  Apply the given transaction to produce a new state.
  */
  apply(tr) {
    return this.applyTransaction(tr).state;
  }
  /**
  @internal
  */
  filterTransaction(tr, ignore = -1) {
    for (let i = 0; i < this.config.plugins.length; i++)
      if (i != ignore) {
        let plugin = this.config.plugins[i];
        if (plugin.spec.filterTransaction && !plugin.spec.filterTransaction.call(plugin, tr, this))
          return false;
      }
    return true;
  }
  /**
  Verbose variant of [`apply`](https://prosemirror.net/docs/ref/#state.EditorState.apply) that
  returns the precise transactions that were applied (which might
  be influenced by the [transaction
  hooks](https://prosemirror.net/docs/ref/#state.PluginSpec.filterTransaction) of
  plugins) along with the new state.
  */
  applyTransaction(rootTr) {
    if (!this.filterTransaction(rootTr))
      return { state: this, transactions: [] };
    let trs = [rootTr], newState = this.applyInner(rootTr), seen = null;
    for (; ; ) {
      let haveNew = false;
      for (let i = 0; i < this.config.plugins.length; i++) {
        let plugin = this.config.plugins[i];
        if (plugin.spec.appendTransaction) {
          let n = seen ? seen[i].n : 0, oldState = seen ? seen[i].state : this;
          let tr = n < trs.length && plugin.spec.appendTransaction.call(plugin, n ? trs.slice(n) : trs, oldState, newState);
          if (tr && newState.filterTransaction(tr, i)) {
            tr.setMeta("appendedTransaction", rootTr);
            if (!seen) {
              seen = [];
              for (let j = 0; j < this.config.plugins.length; j++)
                seen.push(j < i ? { state: newState, n: trs.length } : { state: this, n: 0 });
            }
            trs.push(tr);
            newState = newState.applyInner(tr);
            haveNew = true;
          }
          if (seen)
            seen[i] = { state: newState, n: trs.length };
        }
      }
      if (!haveNew)
        return { state: newState, transactions: trs };
    }
  }
  /**
  @internal
  */
  applyInner(tr) {
    if (!tr.before.eq(this.doc))
      throw new RangeError("Applying a mismatched transaction");
    let newInstance = new _EditorState(this.config), fields = this.config.fields;
    for (let i = 0; i < fields.length; i++) {
      let field = fields[i];
      newInstance[field.name] = field.apply(tr, this[field.name], this, newInstance);
    }
    return newInstance;
  }
  /**
  Accessor that constructs and returns a new [transaction](https://prosemirror.net/docs/ref/#state.Transaction) from this state.
  */
  get tr() {
    return new Transaction(this);
  }
  /**
  Create a new state.
  */
  static create(config) {
    let $config = new Configuration(config.doc ? config.doc.type.schema : config.schema, config.plugins);
    let instance = new _EditorState($config);
    for (let i = 0; i < $config.fields.length; i++)
      instance[$config.fields[i].name] = $config.fields[i].init(config, instance);
    return instance;
  }
  /**
  Create a new state based on this one, but with an adjusted set
  of active plugins. State fields that exist in both sets of
  plugins are kept unchanged. Those that no longer exist are
  dropped, and those that are new are initialized using their
  [`init`](https://prosemirror.net/docs/ref/#state.StateField.init) method, passing in the new
  configuration object..
  */
  reconfigure(config) {
    let $config = new Configuration(this.schema, config.plugins);
    let fields = $config.fields, instance = new _EditorState($config);
    for (let i = 0; i < fields.length; i++) {
      let name = fields[i].name;
      instance[name] = this.hasOwnProperty(name) ? this[name] : fields[i].init(config, instance);
    }
    return instance;
  }
  /**
  Serialize this state to JSON. If you want to serialize the state
  of plugins, pass an object mapping property names to use in the
  resulting JSON object to plugin objects. The argument may also be
  a string or number, in which case it is ignored, to support the
  way `JSON.stringify` calls `toString` methods.
  */
  toJSON(pluginFields) {
    let result = { doc: this.doc.toJSON(), selection: this.selection.toJSON() };
    if (this.storedMarks)
      result.storedMarks = this.storedMarks.map((m) => m.toJSON());
    if (pluginFields && typeof pluginFields == "object")
      for (let prop in pluginFields) {
        if (prop == "doc" || prop == "selection")
          throw new RangeError("The JSON fields `doc` and `selection` are reserved");
        let plugin = pluginFields[prop], state = plugin.spec.state;
        if (state && state.toJSON)
          result[prop] = state.toJSON.call(plugin, this[plugin.key]);
      }
    return result;
  }
  /**
  Deserialize a JSON representation of a state. `config` should
  have at least a `schema` field, and should contain array of
  plugins to initialize the state with. `pluginFields` can be used
  to deserialize the state of plugins, by associating plugin
  instances with the property names they use in the JSON object.
  */
  static fromJSON(config, json, pluginFields) {
    if (!json)
      throw new RangeError("Invalid input for EditorState.fromJSON");
    if (!config.schema)
      throw new RangeError("Required config field 'schema' missing");
    let $config = new Configuration(config.schema, config.plugins);
    let instance = new _EditorState($config);
    $config.fields.forEach((field) => {
      if (field.name == "doc") {
        instance.doc = Node.fromJSON(config.schema, json.doc);
      } else if (field.name == "selection") {
        instance.selection = Selection.fromJSON(instance.doc, json.selection);
      } else if (field.name == "storedMarks") {
        if (json.storedMarks)
          instance.storedMarks = json.storedMarks.map(config.schema.markFromJSON);
      } else {
        if (pluginFields)
          for (let prop in pluginFields) {
            let plugin = pluginFields[prop], state = plugin.spec.state;
            if (plugin.key == field.name && state && state.fromJSON && Object.prototype.hasOwnProperty.call(json, prop)) {
              instance[field.name] = state.fromJSON.call(plugin, config, json[prop], instance);
              return;
            }
          }
        instance[field.name] = field.init(config, instance);
      }
    });
    return instance;
  }
};
function bindProps(obj, self, target) {
  for (let prop in obj) {
    let val = obj[prop];
    if (val instanceof Function)
      val = val.bind(self);
    else if (prop == "handleDOMEvents")
      val = bindProps(val, self, {});
    target[prop] = val;
  }
  return target;
}
var Plugin = class {
  /**
  Create a plugin.
  */
  constructor(spec) {
    this.spec = spec;
    this.props = {};
    if (spec.props)
      bindProps(spec.props, this, this.props);
    this.key = spec.key ? spec.key.key : createKey("plugin");
  }
  /**
  Extract the plugin's state field from an editor state.
  */
  getState(state) {
    return state[this.key];
  }
};
var keys = /* @__PURE__ */ Object.create(null);
function createKey(name) {
  if (name in keys)
    return name + "$" + ++keys[name];
  keys[name] = 0;
  return name + "$";
}
var PluginKey = class {
  /**
  Create a plugin key.
  */
  constructor(name = "key") {
    this.key = createKey(name);
  }
  /**
  Get the active plugin with this key, if any, from an editor
  state.
  */
  get(state) {
    return state.config.pluginsByKey[this.key];
  }
  /**
  Get the plugin's state from an editor state.
  */
  getState(state) {
    return state[this.key];
  }
};

// node_modules/w3c-keyname/index.js
var base = {
  8: "Backspace",
  9: "Tab",
  10: "Enter",
  12: "NumLock",
  13: "Enter",
  16: "Shift",
  17: "Control",
  18: "Alt",
  20: "CapsLock",
  27: "Escape",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  44: "PrintScreen",
  45: "Insert",
  46: "Delete",
  59: ";",
  61: "=",
  91: "Meta",
  92: "Meta",
  106: "*",
  107: "+",
  108: ",",
  109: "-",
  110: ".",
  111: "/",
  144: "NumLock",
  145: "ScrollLock",
  160: "Shift",
  161: "Shift",
  162: "Control",
  163: "Control",
  164: "Alt",
  165: "Alt",
  173: "-",
  186: ";",
  187: "=",
  188: ",",
  189: "-",
  190: ".",
  191: "/",
  192: "`",
  219: "[",
  220: "\\",
  221: "]",
  222: "'"
};
var shift = {
  48: ")",
  49: "!",
  50: "@",
  51: "#",
  52: "$",
  53: "%",
  54: "^",
  55: "&",
  56: "*",
  57: "(",
  59: ":",
  61: "+",
  173: "_",
  186: ":",
  187: "+",
  188: "<",
  189: "_",
  190: ">",
  191: "?",
  192: "~",
  219: "{",
  220: "|",
  221: "}",
  222: '"'
};
var mac = typeof navigator != "undefined" && /Mac/.test(navigator.platform);
var ie = typeof navigator != "undefined" && /MSIE \d|Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent);
for (i = 0; i < 10; i++) base[48 + i] = base[96 + i] = String(i);
var i;
for (i = 1; i <= 24; i++) base[i + 111] = "F" + i;
var i;
for (i = 65; i <= 90; i++) {
  base[i] = String.fromCharCode(i + 32);
  shift[i] = String.fromCharCode(i);
}
var i;
for (code in base) if (!shift.hasOwnProperty(code)) shift[code] = base[code];
var code;
function keyName(event) {
  var ignoreKey = mac && event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey || ie && event.shiftKey && event.key && event.key.length == 1 || event.key == "Unidentified";
  var name = !ignoreKey && event.key || (event.shiftKey ? shift : base)[event.keyCode] || event.key || "Unidentified";
  if (name == "Esc") name = "Escape";
  if (name == "Del") name = "Delete";
  if (name == "Left") name = "ArrowLeft";
  if (name == "Up") name = "ArrowUp";
  if (name == "Right") name = "ArrowRight";
  if (name == "Down") name = "ArrowDown";
  return name;
}

// node_modules/prosemirror-keymap/dist/index.js
var mac2 = typeof navigator != "undefined" && /Mac|iP(hone|[oa]d)/.test(navigator.platform);
var windows = typeof navigator != "undefined" && /Win/.test(navigator.platform);
function normalizeKeyName(name) {
  let parts = name.split(/-(?!$)/), result = parts[parts.length - 1];
  if (result == "Space")
    result = " ";
  let alt, ctrl, shift2, meta;
  for (let i = 0; i < parts.length - 1; i++) {
    let mod = parts[i];
    if (/^(cmd|meta|m)$/i.test(mod))
      meta = true;
    else if (/^a(lt)?$/i.test(mod))
      alt = true;
    else if (/^(c|ctrl|control)$/i.test(mod))
      ctrl = true;
    else if (/^s(hift)?$/i.test(mod))
      shift2 = true;
    else if (/^mod$/i.test(mod)) {
      if (mac2)
        meta = true;
      else
        ctrl = true;
    } else
      throw new Error("Unrecognized modifier name: " + mod);
  }
  if (alt)
    result = "Alt-" + result;
  if (ctrl)
    result = "Ctrl-" + result;
  if (meta)
    result = "Meta-" + result;
  if (shift2)
    result = "Shift-" + result;
  return result;
}
function normalize(map) {
  let copy = /* @__PURE__ */ Object.create(null);
  for (let prop in map)
    copy[normalizeKeyName(prop)] = map[prop];
  return copy;
}
function modifiers(name, event, shift2 = true) {
  if (event.altKey)
    name = "Alt-" + name;
  if (event.ctrlKey)
    name = "Ctrl-" + name;
  if (event.metaKey)
    name = "Meta-" + name;
  if (shift2 && event.shiftKey)
    name = "Shift-" + name;
  return name;
}
function keydownHandler(bindings) {
  let map = normalize(bindings);
  return function(view, event) {
    let name = keyName(event), baseName, direct = map[modifiers(name, event)];
    if (direct && direct(view.state, view.dispatch, view))
      return true;
    if (name.length == 1 && name != " ") {
      if (event.shiftKey) {
        let noShift = map[modifiers(name, event, false)];
        if (noShift && noShift(view.state, view.dispatch, view))
          return true;
      }
      if ((event.altKey || event.metaKey || event.ctrlKey) && // Ctrl-Alt may be used for AltGr on Windows
      !(windows && event.ctrlKey && event.altKey) && (baseName = base[event.keyCode]) && baseName != name) {
        let fromCode = map[modifiers(baseName, event)];
        if (fromCode && fromCode(view.state, view.dispatch, view))
          return true;
      }
    }
    return false;
  };
}

// node_modules/prosemirror-tables/dist/index.js
var readFromCache;
var addToCache;
if (typeof WeakMap != "undefined") {
  let cache = /* @__PURE__ */ new WeakMap();
  readFromCache = (key) => cache.get(key);
  addToCache = (key, value) => {
    cache.set(key, value);
    return value;
  };
} else {
  const cache = [];
  const cacheSize = 10;
  let cachePos = 0;
  readFromCache = (key) => {
    for (let i = 0; i < cache.length; i += 2) if (cache[i] == key) return cache[i + 1];
  };
  addToCache = (key, value) => {
    if (cachePos == cacheSize) cachePos = 0;
    cache[cachePos++] = key;
    return cache[cachePos++] = value;
  };
}
var TableMap = class {
  constructor(width, height, map, problems) {
    this.width = width;
    this.height = height;
    this.map = map;
    this.problems = problems;
  }
  findCell(pos) {
    for (let i = 0; i < this.map.length; i++) {
      const curPos = this.map[i];
      if (curPos != pos) continue;
      const left = i % this.width;
      const top = i / this.width | 0;
      let right = left + 1;
      let bottom = top + 1;
      for (let j = 1; right < this.width && this.map[i + j] == curPos; j++) right++;
      for (let j = 1; bottom < this.height && this.map[i + this.width * j] == curPos; j++) bottom++;
      return {
        left,
        top,
        right,
        bottom
      };
    }
    throw new RangeError(`No cell with offset ${pos} found`);
  }
  colCount(pos) {
    for (let i = 0; i < this.map.length; i++) if (this.map[i] == pos) return i % this.width;
    throw new RangeError(`No cell with offset ${pos} found`);
  }
  nextCell(pos, axis, dir) {
    const { left, right, top, bottom } = this.findCell(pos);
    if (axis == "horiz") {
      if (dir < 0 ? left == 0 : right == this.width) return null;
      return this.map[top * this.width + (dir < 0 ? left - 1 : right)];
    } else {
      if (dir < 0 ? top == 0 : bottom == this.height) return null;
      return this.map[left + this.width * (dir < 0 ? top - 1 : bottom)];
    }
  }
  rectBetween(a, b) {
    const { left: leftA, right: rightA, top: topA, bottom: bottomA } = this.findCell(a);
    const { left: leftB, right: rightB, top: topB, bottom: bottomB } = this.findCell(b);
    return {
      left: Math.min(leftA, leftB),
      top: Math.min(topA, topB),
      right: Math.max(rightA, rightB),
      bottom: Math.max(bottomA, bottomB)
    };
  }
  cellsInRect(rect) {
    const result = [];
    const seen = {};
    for (let row = rect.top; row < rect.bottom; row++) for (let col = rect.left; col < rect.right; col++) {
      const index = row * this.width + col;
      const pos = this.map[index];
      if (seen[pos]) continue;
      seen[pos] = true;
      if (col == rect.left && col && this.map[index - 1] == pos || row == rect.top && row && this.map[index - this.width] == pos) continue;
      result.push(pos);
    }
    return result;
  }
  positionAt(row, col, table) {
    for (let i = 0, rowStart = 0; ; i++) {
      const rowEnd = rowStart + table.child(i).nodeSize;
      if (i == row) {
        let index = col + row * this.width;
        const rowEndIndex = (row + 1) * this.width;
        while (index < rowEndIndex && this.map[index] < rowStart) index++;
        return index == rowEndIndex ? rowEnd - 1 : this.map[index];
      }
      rowStart = rowEnd;
    }
  }
  static get(table) {
    return readFromCache(table) || addToCache(table, computeMap(table));
  }
};
function computeMap(table) {
  if (table.type.spec.tableRole != "table") throw new RangeError("Not a table node: " + table.type.name);
  const width = findWidth(table), height = table.childCount;
  const map = [];
  let mapPos = 0;
  let problems = null;
  const colWidths = [];
  for (let i = 0, e = width * height; i < e; i++) map[i] = 0;
  for (let row = 0, pos = 0; row < height; row++) {
    const rowNode = table.child(row);
    pos++;
    for (let i = 0; ; i++) {
      while (mapPos < map.length && map[mapPos] != 0) mapPos++;
      if (i == rowNode.childCount) break;
      const cellNode = rowNode.child(i);
      const { colspan, rowspan, colwidth } = cellNode.attrs;
      for (let h = 0; h < rowspan; h++) {
        if (h + row >= height) {
          (problems || (problems = [])).push({
            type: "overlong_rowspan",
            pos,
            n: rowspan - h
          });
          break;
        }
        const start = mapPos + h * width;
        for (let w = 0; w < colspan; w++) {
          if (map[start + w] == 0) map[start + w] = pos;
          else (problems || (problems = [])).push({
            type: "collision",
            row,
            pos,
            n: colspan - w
          });
          const colW = colwidth && colwidth[w];
          if (colW) {
            const widthIndex = (start + w) % width * 2, prev = colWidths[widthIndex];
            if (prev == null || prev != colW && colWidths[widthIndex + 1] == 1) {
              colWidths[widthIndex] = colW;
              colWidths[widthIndex + 1] = 1;
            } else if (prev == colW) colWidths[widthIndex + 1]++;
          }
        }
      }
      mapPos += colspan;
      pos += cellNode.nodeSize;
    }
    const expectedPos = (row + 1) * width;
    let missing = 0;
    while (mapPos < expectedPos) if (map[mapPos++] == 0) missing++;
    if (missing) (problems || (problems = [])).push({
      type: "missing",
      row,
      n: missing
    });
    pos++;
  }
  if (width === 0 || height === 0) (problems || (problems = [])).push({ type: "zero_sized" });
  const tableMap = new TableMap(width, height, map, problems);
  let badWidths = false;
  for (let i = 0; !badWidths && i < colWidths.length; i += 2) if (colWidths[i] != null && colWidths[i + 1] < height) badWidths = true;
  if (badWidths) findBadColWidths(tableMap, colWidths, table);
  return tableMap;
}
function findWidth(table) {
  let width = -1;
  let hasRowSpan = false;
  for (let row = 0; row < table.childCount; row++) {
    const rowNode = table.child(row);
    let rowWidth = 0;
    if (hasRowSpan) for (let j = 0; j < row; j++) {
      const prevRow = table.child(j);
      for (let i = 0; i < prevRow.childCount; i++) {
        const cell = prevRow.child(i);
        if (j + cell.attrs.rowspan > row) rowWidth += cell.attrs.colspan;
      }
    }
    for (let i = 0; i < rowNode.childCount; i++) {
      const cell = rowNode.child(i);
      rowWidth += cell.attrs.colspan;
      if (cell.attrs.rowspan > 1) hasRowSpan = true;
    }
    if (width == -1) width = rowWidth;
    else if (width != rowWidth) width = Math.max(width, rowWidth);
  }
  return width;
}
function findBadColWidths(map, colWidths, table) {
  if (!map.problems) map.problems = [];
  const seen = {};
  for (let i = 0; i < map.map.length; i++) {
    const pos = map.map[i];
    if (seen[pos]) continue;
    seen[pos] = true;
    const node = table.nodeAt(pos);
    if (!node) throw new RangeError(`No cell with offset ${pos} found`);
    let updated = null;
    const attrs2 = node.attrs;
    for (let j = 0; j < attrs2.colspan; j++) {
      const colWidth = colWidths[(i + j) % map.width * 2];
      if (colWidth != null && (!attrs2.colwidth || attrs2.colwidth[j] != colWidth)) (updated || (updated = freshColWidth(attrs2)))[j] = colWidth;
    }
    if (updated) map.problems.unshift({
      type: "colwidth mismatch",
      pos,
      colwidth: updated
    });
  }
}
function freshColWidth(attrs2) {
  if (attrs2.colwidth) return attrs2.colwidth.slice();
  const result = [];
  for (let i = 0; i < attrs2.colspan; i++) result.push(0);
  return result;
}
function tableNodeTypes(schema2) {
  let result = schema2.cached.tableNodeTypes;
  if (!result) {
    result = schema2.cached.tableNodeTypes = {};
    for (const name in schema2.nodes) {
      const type = schema2.nodes[name], role = type.spec.tableRole;
      if (role) result[role] = type;
    }
  }
  return result;
}
var tableEditingKey = new PluginKey("selectingCells");
function cellAround($pos) {
  for (let d = $pos.depth - 1; d > 0; d--) if ($pos.node(d).type.spec.tableRole == "row") return $pos.node(0).resolve($pos.before(d + 1));
  return null;
}
function isInTable(state) {
  const $head = state.selection.$head;
  for (let d = $head.depth; d > 0; d--) if ($head.node(d).type.spec.tableRole == "row") return true;
  return false;
}
function selectionCell(state) {
  const sel = state.selection;
  if ("$anchorCell" in sel && sel.$anchorCell) return sel.$anchorCell.pos > sel.$headCell.pos ? sel.$anchorCell : sel.$headCell;
  else if ("node" in sel && sel.node && sel.node.type.spec.tableRole == "cell") return sel.$anchor;
  const $cell = cellAround(sel.$head) || cellNear(sel.$head);
  if ($cell) return $cell;
  throw new RangeError(`No cell found around position ${sel.head}`);
}
function cellNear($pos) {
  for (let after = $pos.nodeAfter, pos = $pos.pos; after; after = after.firstChild, pos++) {
    const role = after.type.spec.tableRole;
    if (role == "cell" || role == "header_cell") return $pos.doc.resolve(pos);
  }
  for (let before = $pos.nodeBefore, pos = $pos.pos; before; before = before.lastChild, pos--) {
    const role = before.type.spec.tableRole;
    if (role == "cell" || role == "header_cell") return $pos.doc.resolve(pos - before.nodeSize);
  }
}
function pointsAtCell($pos) {
  return $pos.parent.type.spec.tableRole == "row" && !!$pos.nodeAfter;
}
function inSameTable($cellA, $cellB) {
  return $cellA.depth == $cellB.depth && $cellA.pos >= $cellB.start(-1) && $cellA.pos <= $cellB.end(-1);
}
function nextCell($pos, axis, dir) {
  const table = $pos.node(-1);
  const map = TableMap.get(table);
  const tableStart = $pos.start(-1);
  const moved = map.nextCell($pos.pos - tableStart, axis, dir);
  return moved == null ? null : $pos.node(0).resolve(tableStart + moved);
}
function removeColSpan(attrs2, pos, n = 1) {
  const result = {
    ...attrs2,
    colspan: attrs2.colspan - n
  };
  if (result.colwidth) {
    result.colwidth = result.colwidth.slice();
    result.colwidth.splice(pos, n);
    if (!result.colwidth.some((w) => w > 0)) result.colwidth = null;
  }
  return result;
}
var CellSelection = class CellSelection2 extends Selection {
  constructor($anchorCell, $headCell = $anchorCell) {
    const table = $anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = $anchorCell.start(-1);
    const rect = map.rectBetween($anchorCell.pos - tableStart, $headCell.pos - tableStart);
    const doc = $anchorCell.node(0);
    const cells = map.cellsInRect(rect).filter((p) => p != $headCell.pos - tableStart);
    cells.unshift($headCell.pos - tableStart);
    const ranges = cells.map((pos) => {
      const cell = table.nodeAt(pos);
      if (!cell) throw new RangeError(`No cell with offset ${pos} found`);
      const from = tableStart + pos + 1;
      return new SelectionRange(doc.resolve(from), doc.resolve(from + cell.content.size));
    });
    super(ranges[0].$from, ranges[0].$to, ranges);
    this.$anchorCell = $anchorCell;
    this.$headCell = $headCell;
  }
  map(doc, mapping) {
    const $anchorCell = doc.resolve(mapping.map(this.$anchorCell.pos));
    const $headCell = doc.resolve(mapping.map(this.$headCell.pos));
    if (pointsAtCell($anchorCell) && pointsAtCell($headCell) && inSameTable($anchorCell, $headCell)) {
      const tableChanged = this.$anchorCell.node(-1) != $anchorCell.node(-1);
      if (tableChanged && this.isRowSelection()) return CellSelection2.rowSelection($anchorCell, $headCell);
      else if (tableChanged && this.isColSelection()) return CellSelection2.colSelection($anchorCell, $headCell);
      else return new CellSelection2($anchorCell, $headCell);
    }
    return TextSelection.between($anchorCell, $headCell);
  }
  content() {
    const table = this.$anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = this.$anchorCell.start(-1);
    const rect = map.rectBetween(this.$anchorCell.pos - tableStart, this.$headCell.pos - tableStart);
    const seen = {};
    const rows = [];
    for (let row = rect.top; row < rect.bottom; row++) {
      const rowContent = [];
      for (let index = row * map.width + rect.left, col = rect.left; col < rect.right; col++, index++) {
        const pos = map.map[index];
        if (seen[pos]) continue;
        seen[pos] = true;
        const cellRect = map.findCell(pos);
        let cell = table.nodeAt(pos);
        if (!cell) throw new RangeError(`No cell with offset ${pos} found`);
        const extraLeft = rect.left - cellRect.left;
        const extraRight = cellRect.right - rect.right;
        if (extraLeft > 0 || extraRight > 0) {
          let attrs2 = cell.attrs;
          if (extraLeft > 0) attrs2 = removeColSpan(attrs2, 0, extraLeft);
          if (extraRight > 0) attrs2 = removeColSpan(attrs2, attrs2.colspan - extraRight, extraRight);
          if (cellRect.left < rect.left) {
            cell = cell.type.createAndFill(attrs2);
            if (!cell) throw new RangeError(`Could not create cell with attrs ${JSON.stringify(attrs2)}`);
          } else cell = cell.type.create(attrs2, cell.content);
        }
        if (cellRect.top < rect.top || cellRect.bottom > rect.bottom) {
          const attrs2 = {
            ...cell.attrs,
            rowspan: Math.min(cellRect.bottom, rect.bottom) - Math.max(cellRect.top, rect.top)
          };
          if (cellRect.top < rect.top) cell = cell.type.createAndFill(attrs2);
          else cell = cell.type.create(attrs2, cell.content);
        }
        rowContent.push(cell);
      }
      rows.push(table.child(row).copy(Fragment.from(rowContent)));
    }
    const fragment = this.isColSelection() && this.isRowSelection() ? table : rows;
    return new Slice(Fragment.from(fragment), 1, 1);
  }
  replace(tr, content = Slice.empty) {
    const mapFrom = tr.steps.length, ranges = this.ranges;
    for (let i = 0; i < ranges.length; i++) {
      const { $from, $to } = ranges[i], mapping = tr.mapping.slice(mapFrom);
      tr.replace(mapping.map($from.pos), mapping.map($to.pos), i ? Slice.empty : content);
    }
    const sel = Selection.findFrom(tr.doc.resolve(tr.mapping.slice(mapFrom).map(this.to)), -1);
    if (sel) tr.setSelection(sel);
  }
  replaceWith(tr, node) {
    this.replace(tr, new Slice(Fragment.from(node), 0, 0));
  }
  forEachCell(f) {
    const table = this.$anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = this.$anchorCell.start(-1);
    const cells = map.cellsInRect(map.rectBetween(this.$anchorCell.pos - tableStart, this.$headCell.pos - tableStart));
    for (let i = 0; i < cells.length; i++) f(table.nodeAt(cells[i]), tableStart + cells[i]);
  }
  isColSelection() {
    const anchorTop = this.$anchorCell.index(-1);
    const headTop = this.$headCell.index(-1);
    if (Math.min(anchorTop, headTop) > 0) return false;
    const anchorBottom = anchorTop + this.$anchorCell.nodeAfter.attrs.rowspan;
    const headBottom = headTop + this.$headCell.nodeAfter.attrs.rowspan;
    return Math.max(anchorBottom, headBottom) == this.$headCell.node(-1).childCount;
  }
  static colSelection($anchorCell, $headCell = $anchorCell) {
    const table = $anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = $anchorCell.start(-1);
    const anchorRect = map.findCell($anchorCell.pos - tableStart);
    const headRect = map.findCell($headCell.pos - tableStart);
    const doc = $anchorCell.node(0);
    if (anchorRect.top <= headRect.top) {
      if (anchorRect.top > 0) $anchorCell = doc.resolve(tableStart + map.map[anchorRect.left]);
      if (headRect.bottom < map.height) $headCell = doc.resolve(tableStart + map.map[map.width * (map.height - 1) + headRect.right - 1]);
    } else {
      if (headRect.top > 0) $headCell = doc.resolve(tableStart + map.map[headRect.left]);
      if (anchorRect.bottom < map.height) $anchorCell = doc.resolve(tableStart + map.map[map.width * (map.height - 1) + anchorRect.right - 1]);
    }
    return new CellSelection2($anchorCell, $headCell);
  }
  isRowSelection() {
    const table = this.$anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = this.$anchorCell.start(-1);
    const anchorLeft = map.colCount(this.$anchorCell.pos - tableStart);
    const headLeft = map.colCount(this.$headCell.pos - tableStart);
    if (Math.min(anchorLeft, headLeft) > 0) return false;
    const anchorRight = anchorLeft + this.$anchorCell.nodeAfter.attrs.colspan;
    const headRight = headLeft + this.$headCell.nodeAfter.attrs.colspan;
    return Math.max(anchorRight, headRight) == map.width;
  }
  eq(other) {
    return other instanceof CellSelection2 && other.$anchorCell.pos == this.$anchorCell.pos && other.$headCell.pos == this.$headCell.pos;
  }
  static rowSelection($anchorCell, $headCell = $anchorCell) {
    const table = $anchorCell.node(-1);
    const map = TableMap.get(table);
    const tableStart = $anchorCell.start(-1);
    const anchorRect = map.findCell($anchorCell.pos - tableStart);
    const headRect = map.findCell($headCell.pos - tableStart);
    const doc = $anchorCell.node(0);
    if (anchorRect.left <= headRect.left) {
      if (anchorRect.left > 0) $anchorCell = doc.resolve(tableStart + map.map[anchorRect.top * map.width]);
      if (headRect.right < map.width) $headCell = doc.resolve(tableStart + map.map[map.width * (headRect.top + 1) - 1]);
    } else {
      if (headRect.left > 0) $headCell = doc.resolve(tableStart + map.map[headRect.top * map.width]);
      if (anchorRect.right < map.width) $anchorCell = doc.resolve(tableStart + map.map[map.width * (anchorRect.top + 1) - 1]);
    }
    return new CellSelection2($anchorCell, $headCell);
  }
  toJSON() {
    return {
      type: "cell",
      anchor: this.$anchorCell.pos,
      head: this.$headCell.pos
    };
  }
  static fromJSON(doc, json) {
    return new CellSelection2(doc.resolve(json.anchor), doc.resolve(json.head));
  }
  static create(doc, anchorCell, headCell = anchorCell) {
    return new CellSelection2(doc.resolve(anchorCell), doc.resolve(headCell));
  }
  getBookmark() {
    return new CellBookmark(this.$anchorCell.pos, this.$headCell.pos);
  }
};
CellSelection.prototype.visible = false;
Selection.jsonID("cell", CellSelection);
var CellBookmark = class CellBookmark2 {
  constructor(anchor, head) {
    this.anchor = anchor;
    this.head = head;
  }
  map(mapping) {
    return new CellBookmark2(mapping.map(this.anchor), mapping.map(this.head));
  }
  resolve(doc) {
    const $anchorCell = doc.resolve(this.anchor), $headCell = doc.resolve(this.head);
    if ($anchorCell.parent.type.spec.tableRole == "row" && $headCell.parent.type.spec.tableRole == "row" && $anchorCell.index() < $anchorCell.parent.childCount && $headCell.index() < $headCell.parent.childCount && inSameTable($anchorCell, $headCell)) return new CellSelection($anchorCell, $headCell);
    else return Selection.near($headCell, 1);
  }
};
var fixTablesKey = new PluginKey("fix-tables");
function changedDescendants(old, cur, offset, f) {
  const oldSize = old.childCount, curSize = cur.childCount;
  outer: for (let i = 0, j = 0; i < curSize; i++) {
    const child = cur.child(i);
    for (let scan = j, e = Math.min(oldSize, i + 3); scan < e; scan++) if (old.child(scan) == child) {
      j = scan + 1;
      offset += child.nodeSize;
      continue outer;
    }
    f(child, offset);
    if (j < oldSize && old.child(j).sameMarkup(child)) changedDescendants(old.child(j), child, offset + 1, f);
    else child.nodesBetween(0, child.content.size, f, offset + 1);
    offset += child.nodeSize;
  }
}
function fixTables(state, oldState) {
  let tr;
  const check = (node, pos) => {
    if (node.type.spec.tableRole == "table") tr = fixTable(state, node, pos, tr);
  };
  if (!oldState) state.doc.descendants(check);
  else if (oldState.doc != state.doc) changedDescendants(oldState.doc, state.doc, 0, check);
  return tr;
}
function fixTable(state, table, tablePos, tr) {
  const map = TableMap.get(table);
  if (!map.problems) return tr;
  if (!tr) tr = state.tr;
  const mustAdd = [];
  for (let i = 0; i < map.height; i++) mustAdd.push(0);
  for (let i = 0; i < map.problems.length; i++) {
    const prob = map.problems[i];
    if (prob.type == "collision") {
      const cell = table.nodeAt(prob.pos);
      if (!cell) continue;
      const attrs2 = cell.attrs;
      for (let j = 0; j < attrs2.rowspan; j++) mustAdd[prob.row + j] += prob.n;
      tr.setNodeMarkup(tr.mapping.map(tablePos + 1 + prob.pos), null, removeColSpan(attrs2, attrs2.colspan - prob.n, prob.n));
    } else if (prob.type == "missing") mustAdd[prob.row] += prob.n;
    else if (prob.type == "overlong_rowspan") {
      const cell = table.nodeAt(prob.pos);
      if (!cell) continue;
      tr.setNodeMarkup(tr.mapping.map(tablePos + 1 + prob.pos), null, {
        ...cell.attrs,
        rowspan: cell.attrs.rowspan - prob.n
      });
    } else if (prob.type == "colwidth mismatch") {
      const cell = table.nodeAt(prob.pos);
      if (!cell) continue;
      tr.setNodeMarkup(tr.mapping.map(tablePos + 1 + prob.pos), null, {
        ...cell.attrs,
        colwidth: prob.colwidth
      });
    } else if (prob.type == "zero_sized") {
      const pos = tr.mapping.map(tablePos);
      tr.delete(pos, pos + table.nodeSize);
    }
  }
  let first, last;
  for (let i = 0; i < mustAdd.length; i++) if (mustAdd[i]) {
    if (first == null) first = i;
    last = i;
  }
  for (let i = 0, pos = tablePos + 1; i < map.height; i++) {
    const row = table.child(i);
    const end = pos + row.nodeSize;
    const add = mustAdd[i];
    if (add > 0) {
      let role = "cell";
      if (row.firstChild) role = row.firstChild.type.spec.tableRole;
      const nodes2 = [];
      for (let j = 0; j < add; j++) {
        const node = tableNodeTypes(state.schema)[role].createAndFill();
        if (node) nodes2.push(node);
      }
      const side = (i == 0 || first == i - 1) && last == i ? pos + 1 : end - 1;
      tr.insert(tr.mapping.map(side), nodes2);
    }
    pos = end;
  }
  return tr.setMeta(fixTablesKey, { fixTables: true });
}
function selectedRect(state) {
  const sel = state.selection;
  const $pos = selectionCell(state);
  const table = $pos.node(-1);
  const tableStart = $pos.start(-1);
  const map = TableMap.get(table);
  return {
    ...sel instanceof CellSelection ? map.rectBetween(sel.$anchorCell.pos - tableStart, sel.$headCell.pos - tableStart) : map.findCell($pos.pos - tableStart),
    tableStart,
    map,
    table
  };
}
function deprecated_toggleHeader(type) {
  return function(state, dispatch) {
    if (!isInTable(state)) return false;
    if (dispatch) {
      const types = tableNodeTypes(state.schema);
      const rect = selectedRect(state), tr = state.tr;
      const cells = rect.map.cellsInRect(type == "column" ? {
        left: rect.left,
        top: 0,
        right: rect.right,
        bottom: rect.map.height
      } : type == "row" ? {
        left: 0,
        top: rect.top,
        right: rect.map.width,
        bottom: rect.bottom
      } : rect);
      const nodes2 = cells.map((pos) => rect.table.nodeAt(pos));
      for (let i = 0; i < cells.length; i++) if (nodes2[i].type == types.header_cell) tr.setNodeMarkup(rect.tableStart + cells[i], types.cell, nodes2[i].attrs);
      if (tr.steps.length === 0) for (let i = 0; i < cells.length; i++) tr.setNodeMarkup(rect.tableStart + cells[i], types.header_cell, nodes2[i].attrs);
      dispatch(tr);
    }
    return true;
  };
}
function isHeaderEnabledByType(type, rect, types) {
  const cellPositions = rect.map.cellsInRect({
    left: 0,
    top: 0,
    right: type == "row" ? rect.map.width : 1,
    bottom: type == "column" ? rect.map.height : 1
  });
  for (let i = 0; i < cellPositions.length; i++) {
    const cell = rect.table.nodeAt(cellPositions[i]);
    if (cell && cell.type !== types.header_cell) return false;
  }
  return true;
}
function toggleHeader(type, options) {
  options = options || { useDeprecatedLogic: false };
  if (options.useDeprecatedLogic) return deprecated_toggleHeader(type);
  return function(state, dispatch) {
    if (!isInTable(state)) return false;
    if (dispatch) {
      const types = tableNodeTypes(state.schema);
      const rect = selectedRect(state), tr = state.tr;
      const isHeaderRowEnabled = isHeaderEnabledByType("row", rect, types);
      const isHeaderColumnEnabled = isHeaderEnabledByType("column", rect, types);
      const selectionStartsAt = (type === "column" ? isHeaderRowEnabled : type === "row" ? isHeaderColumnEnabled : false) ? 1 : 0;
      const cellsRect = type == "column" ? {
        left: 0,
        top: selectionStartsAt,
        right: 1,
        bottom: rect.map.height
      } : type == "row" ? {
        left: selectionStartsAt,
        top: 0,
        right: rect.map.width,
        bottom: 1
      } : rect;
      const newType = type == "column" ? isHeaderColumnEnabled ? types.cell : types.header_cell : type == "row" ? isHeaderRowEnabled ? types.cell : types.header_cell : types.cell;
      rect.map.cellsInRect(cellsRect).forEach((relativeCellPos) => {
        const cellPos = relativeCellPos + rect.tableStart;
        const cell = tr.doc.nodeAt(cellPos);
        if (cell) tr.setNodeMarkup(cellPos, newType, cell.attrs);
      });
      dispatch(tr);
    }
    return true;
  };
}
var toggleHeaderRow = toggleHeader("row", { useDeprecatedLogic: true });
var toggleHeaderColumn = toggleHeader("column", { useDeprecatedLogic: true });
var toggleHeaderCell = toggleHeader("cell", { useDeprecatedLogic: true });
function deleteCellSelection(state, dispatch) {
  const sel = state.selection;
  if (!(sel instanceof CellSelection)) return false;
  if (dispatch) {
    const tr = state.tr;
    const baseContent = tableNodeTypes(state.schema).cell.createAndFill().content;
    sel.forEachCell((cell, pos) => {
      if (!cell.content.eq(baseContent)) tr.replace(tr.mapping.map(pos + 1), tr.mapping.map(pos + cell.nodeSize - 1), new Slice(baseContent, 0, 0));
    });
    if (tr.docChanged) dispatch(tr);
  }
  return true;
}
var handleKeyDown = keydownHandler({
  ArrowLeft: arrow("horiz", -1),
  ArrowRight: arrow("horiz", 1),
  ArrowUp: arrow("vert", -1),
  ArrowDown: arrow("vert", 1),
  "Shift-ArrowLeft": shiftArrow("horiz", -1),
  "Shift-ArrowRight": shiftArrow("horiz", 1),
  "Shift-ArrowUp": shiftArrow("vert", -1),
  "Shift-ArrowDown": shiftArrow("vert", 1),
  Backspace: deleteCellSelection,
  "Mod-Backspace": deleteCellSelection,
  Delete: deleteCellSelection,
  "Mod-Delete": deleteCellSelection
});
function maybeSetSelection(state, dispatch, selection) {
  if (selection.eq(state.selection)) return false;
  if (dispatch) dispatch(state.tr.setSelection(selection).scrollIntoView());
  return true;
}
function arrow(axis, dir) {
  return (state, dispatch, view) => {
    if (!view) return false;
    const sel = state.selection;
    if (sel instanceof CellSelection) return maybeSetSelection(state, dispatch, Selection.near(sel.$headCell, dir));
    if (axis != "horiz" && !sel.empty) return false;
    const end = atEndOfCell(view, axis, dir);
    if (end == null) return false;
    if (axis == "horiz") return maybeSetSelection(state, dispatch, Selection.near(state.doc.resolve(sel.head + dir), dir));
    else {
      const $cell = state.doc.resolve(end);
      const $next = nextCell($cell, axis, dir);
      let newSel;
      if ($next) newSel = Selection.near($next, 1);
      else if (dir < 0) newSel = Selection.near(state.doc.resolve($cell.before(-1)), -1);
      else newSel = Selection.near(state.doc.resolve($cell.after(-1)), 1);
      return maybeSetSelection(state, dispatch, newSel);
    }
  };
}
function shiftArrow(axis, dir) {
  return (state, dispatch, view) => {
    if (!view) return false;
    const sel = state.selection;
    let cellSel;
    if (sel instanceof CellSelection) cellSel = sel;
    else {
      const end = atEndOfCell(view, axis, dir);
      if (end == null) return false;
      cellSel = new CellSelection(state.doc.resolve(end));
    }
    const $head = nextCell(cellSel.$headCell, axis, dir);
    if (!$head) return false;
    return maybeSetSelection(state, dispatch, new CellSelection(cellSel.$anchorCell, $head));
  };
}
function atEndOfCell(view, axis, dir) {
  if (!(view.state.selection instanceof TextSelection)) return null;
  const { $head } = view.state.selection;
  for (let d = $head.depth - 1; d >= 0; d--) {
    const parent = $head.node(d);
    if ((dir < 0 ? $head.index(d) : $head.indexAfter(d)) != (dir < 0 ? 0 : parent.childCount)) return null;
    if (parent.type.spec.tableRole == "cell" || parent.type.spec.tableRole == "header_cell") {
      const cellPos = $head.before(d);
      const dirStr = axis == "vert" ? dir > 0 ? "down" : "up" : dir > 0 ? "right" : "left";
      return view.endOfTextblock(dirStr) ? cellPos : null;
    }
  }
  return null;
}
var columnResizingPluginKey = new PluginKey("tableColumnResizing");

// src/doc-repair.ts
var MARK_PRIORITY = {
  cite_mark: 30,
  emphasis_mark: 20,
  underline_mark: 10,
  bold: 2,
  bold_off: 1,
  superscript: 2,
  subscript: 1
};
function sweepExclusiveMarks(tr) {
  tr.doc.descendants((node, pos) => {
    if (!node.isText) return true;
    const ranked = node.marks.filter((m) => m.type.name in MARK_PRIORITY);
    for (const m of ranked) {
      const outranked = ranked.some(
        (other) => other !== m && other.type.excludes(m.type) && MARK_PRIORITY[other.type.name] > MARK_PRIORITY[m.type.name]
      );
      if (outranked) tr.removeMark(pos, pos + node.nodeSize, m.type);
    }
    return true;
  });
}
function canonicalizeHealSentinels(tr) {
  tr.doc.descendants((node, pos) => {
    if (node.type.name !== "tag" && node.type.name !== "analytic") return true;
    const id = String(node.attrs["id"] ?? "");
    if (id.startsWith("crdt-heal-")) {
      tr.setNodeMarkup(pos, void 0, { ...node.attrs, id: "ch-" + id.slice("crdt-heal-".length) });
    }
    return false;
  });
}
function buildDocRepairTr(state) {
  const tr = fixTables(state) ?? state.tr;
  sweepExclusiveMarks(tr);
  const inserts = [];
  tr.doc.descendants((node, pos) => {
    if (node.type.name === "card" && node.firstChild?.type.name !== "tag") {
      inserts.push({ pos: pos + 1, type: "tag" });
    }
    if (node.type.name === "analytic_unit" && node.firstChild?.type.name !== "analytic") {
      inserts.push({ pos: pos + 1, type: "analytic" });
    }
    return true;
  });
  inserts.sort((a, b) => b.pos - a.pos);
  for (const ins of inserts) {
    tr.insert(ins.pos, schema.nodes[ins.type].create());
  }
  canonicalizeHealSentinels(tr);
  return tr.steps.length ? tr : null;
}
function repairDoc(doc) {
  const tr = buildDocRepairTr(EditorState.create({ doc }));
  return tr ? tr.doc : doc;
}

// src/editor/transaction-utils.ts
function changedRange(transactions) {
  let from = Infinity;
  let to = -Infinity;
  const expand = (lo, hi) => {
    if (lo < from) from = lo;
    if (hi > to) to = hi;
  };
  for (const tr of transactions) {
    if (!tr.docChanged) continue;
    for (let i = 0; i < tr.steps.length; i++) {
      const step = tr.steps[i];
      const subMapping = tr.mapping.slice(i + 1);
      const stepMap = step.getMap();
      stepMap.forEach((_oldFrom, _oldTo, newFrom, newTo) => {
        expand(subMapping.map(newFrom, -1), subMapping.map(newTo, 1));
      });
      if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
        expand(subMapping.map(step.from, -1), subMapping.map(step.to, 1));
      }
    }
  }
  if (from === Infinity) return null;
  return { from, to };
}

// src/editor/normalizer-guard.ts
var NORMALIZER_META = "normalizerEdit";
var NORMALIZER_ROUND_META = "normalizerRound";
var NORMALIZER_ROUND_CAP = 8;
function normalizerRound(trs) {
  let max2 = 0;
  for (const t of trs) {
    const r = t.getMeta(NORMALIZER_ROUND_META);
    if (typeof r === "number" && r > max2) max2 = r;
  }
  return max2;
}
function guardNormalizerTr(incoming, tr) {
  const round = normalizerRound(incoming);
  if (round >= NORMALIZER_ROUND_CAP) {
    console.warn(
      "[cardmirror] normalizer round cap reached \u2014 dropping a normalization pass to avoid a dispatch loop"
    );
    return null;
  }
  tr.setMeta(NORMALIZER_META, true);
  tr.setMeta(NORMALIZER_ROUND_META, round + 1);
  return tr;
}

// src/editor/named-style-normalizer-plugin.ts
var BODY_TEXTBLOCKS = /* @__PURE__ */ new Set(["paragraph", "card_body", "cite_paragraph"]);
var STRUCTURAL_TEXTBLOCKS = /* @__PURE__ */ new Set([
  "tag",
  "analytic",
  "pocket",
  "hat",
  "block",
  "undertag"
]);
var namedStyleNormalizerPlugin = new Plugin({
  appendTransaction(transactions, _oldState, newState) {
    const range = changedRange(transactions);
    if (!range) return null;
    const directMark = schema.marks["underline_direct"];
    const namedMark = schema.marks["underline_mark"];
    const citeMark = schema.marks["cite_mark"];
    const emphasisMark = schema.marks["emphasis_mark"];
    let tr = null;
    newState.doc.nodesBetween(range.from, range.to, (node, pos, parent) => {
      if (node.type.name === "image") {
        for (const m of node.marks) {
          if (!IMAGE_ALLOWED_MARKS.has(m.type.name)) {
            if (!tr) tr = newState.tr;
            tr.removeNodeMark(pos, m);
          }
        }
        return false;
      }
      if (!node.isText || !parent) return true;
      const parentName = parent.type.name;
      const hasDirect = node.marks.some((m) => m.type === directMark);
      const hasNamed = node.marks.some((m) => m.type === namedMark);
      const hasCiteOrEmph = node.marks.some(
        (m) => m.type === citeMark || m.type === emphasisMark
      );
      const isBody = BODY_TEXTBLOCKS.has(parentName);
      const isStructural = STRUCTURAL_TEXTBLOCKS.has(parentName);
      if (isBody) {
        if (hasCiteOrEmph) {
          if (hasNamed) {
            if (!tr) tr = newState.tr;
            tr.removeMark(pos, pos + node.nodeSize, namedMark);
          }
          if (hasDirect) {
            if (!tr) tr = newState.tr;
            tr.removeMark(pos, pos + node.nodeSize, directMark);
          }
        } else if (hasDirect) {
          if (!tr) tr = newState.tr;
          tr.removeMark(pos, pos + node.nodeSize, directMark);
          if (!hasNamed) tr.addMark(pos, pos + node.nodeSize, namedMark.create());
        }
      } else if (isStructural && hasNamed) {
        if (!tr) tr = newState.tr;
        tr.removeMark(pos, pos + node.nodeSize, namedMark);
        if (!hasDirect) tr.addMark(pos, pos + node.nodeSize, directMark.create());
      }
      return true;
    });
    return tr === null ? null : guardNormalizerTr(transactions, tr);
  }
});
function normalizeUnderlineMarks(doc) {
  const namedMark = schema.marks["underline_mark"];
  const directMark = schema.marks["underline_direct"];
  const citeMark = schema.marks["cite_mark"];
  const emphasisMark = schema.marks["emphasis_mark"];
  function walk2(node) {
    if (node.isText) return node;
    if (node.isTextblock) {
      const name = node.type.name;
      const isBody = BODY_TEXTBLOCKS.has(name);
      const isStructural = STRUCTURAL_TEXTBLOCKS.has(name);
      if (!isBody && !isStructural) return node;
      const children3 = [];
      let changed2 = false;
      node.forEach((child) => {
        if (!child.isText) {
          children3.push(child);
          return;
        }
        let marks2 = child.marks;
        const hasDirect = marks2.some((m) => m.type === directMark);
        const hasNamed = marks2.some((m) => m.type === namedMark);
        const hasCiteOrEmph = marks2.some(
          (m) => m.type === citeMark || m.type === emphasisMark
        );
        if (isBody) {
          if (hasCiteOrEmph && (hasDirect || hasNamed)) {
            marks2 = marks2.filter(
              (m) => m.type !== directMark && m.type !== namedMark
            );
            changed2 = true;
          } else if (hasDirect) {
            marks2 = marks2.filter((m) => m.type !== directMark);
            if (!hasNamed) marks2 = namedMark.create().addToSet(marks2);
            changed2 = true;
          }
        } else if (isStructural && hasNamed) {
          marks2 = marks2.filter((m) => m.type !== namedMark);
          if (!hasDirect) marks2 = directMark.create().addToSet(marks2);
          changed2 = true;
        }
        children3.push(marks2 === child.marks ? child : child.mark(marks2));
      });
      return changed2 ? node.copy(Fragment.fromArray(children3)) : node;
    }
    const children2 = [];
    let changed = false;
    node.forEach((child) => {
      const next = walk2(child);
      if (next !== child) changed = true;
      children2.push(next);
    });
    return changed ? node.copy(Fragment.fromArray(children2)) : node;
  }
  return walk2(doc);
}

// src/ooxml/base64.ts
var CHUNK = 32768;
function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

// src/ooxml/parse.ts
var import_fast_xml_parser = __toESM(require_fxp(), 1);
var parser = new import_fast_xml_parser.XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  preserveOrder: true,
  trimValues: false,
  parseAttributeValue: false,
  parseTagValue: false,
  // fast-xml-parser ships a "billion laughs" guard that caps the
  // total number of entity expansions per document at 1000. That
  // guard counts every ordinary standard entity (&amp; &lt; &gt;
  // &quot; &apos;) and numeric char-ref toward the budget, so a
  // large, legitimate debate file — which easily contains thousands
  // of ampersands / quotes across document.xml — trips it with
  // "Entity expansion limit exceeded: N > 1000" and fails to load.
  // Standard entities are 1:1, non-recursive replacements (no
  // exponential blow-up); the actual entity-bomb vector is
  // DOCTYPE-declared nested custom entities, which OOXML never uses.
  // We open trusted local files, so lift the cap rather than reject
  // real documents. (depth / entity-count / size guards still apply
  // to any DOCTYPE entities, which OOXML doesn't have anyway.)
  processEntities: {
    enabled: true,
    maxTotalExpansions: Infinity,
    maxExpandedLength: Infinity
  }
});
function parseXml(xml) {
  return parser.parse(xml);
}
function findChild(nodes2, tag) {
  for (const node of nodes2) {
    if (tag in node) return node;
  }
  return null;
}
function attrs(node) {
  return node[":@"] ?? {};
}
function children(node, tag) {
  const value = node[tag];
  if (Array.isArray(value)) return value;
  return [];
}
function serializeXmlNodes(nodes2) {
  let out = "";
  for (const node of nodes2) {
    out += serializeXmlNode(node);
  }
  return out;
}
function serializeXmlNode(node) {
  for (const key of Object.keys(node)) {
    if (key === ":@") continue;
    if (key === "#text") {
      return escText2(String(node[key] ?? ""));
    }
    const attrPart = serializeAttrs(node[":@"] ?? {});
    const value = node[key];
    if (Array.isArray(value) && value.length > 0) {
      return `<${key}${attrPart}>${serializeXmlNodes(value)}</${key}>`;
    }
    return `<${key}${attrPart}/>`;
  }
  return "";
}
function serializeAttrs(a) {
  let out = "";
  for (const [k, v] of Object.entries(a)) {
    out += ` ${k}="${escAttr2(String(v))}"`;
  }
  return out;
}
function escText2(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr2(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
function bodyParagraphsInOrder(bodyChildren) {
  const out = [];
  const walk2 = (nodes2) => {
    for (const node of nodes2) {
      if ("w:p" in node) {
        out.push(node);
      } else if ("w:sdt" in node) {
        const content = findChild(children(node, "w:sdt"), "w:sdtContent");
        if (content) walk2(children(content, "w:sdtContent"));
      }
    }
  };
  walk2(bodyChildren);
  return out;
}
function textContent(node) {
  const nodes2 = Array.isArray(node) ? node : [node];
  let out = "";
  for (const n of nodes2) {
    for (const [k, v] of Object.entries(n)) {
      if (k === ":@") continue;
      if (k === "#text") {
        out += String(v ?? "");
      } else if (Array.isArray(v)) {
        out += textContent(v);
      }
    }
  }
  return out;
}

// src/ooxml/legacy-styles.ts
var BY_NAME = {
  // Tags → always the tag level.
  tags: "tag",
  tag: "tag",
  "debate tag": "tag",
  "heading 4": "tag",
  // Organizational headings → a level chosen per document (see buildLegacyHeadingMap).
  "block headings": "heading",
  "block heading": "heading",
  "block title": "heading",
  "hidden block header": "heading",
  "heading 1": "heading",
  "heading 2": "heading",
  "heading 3": "heading",
  // Citation paragraph → Normal (the cite is the char-cite on its runs).
  cites: "cite",
  cite: "cite",
  "debate cite main": "cite",
  "debate secondary cite": "cite",
  normalcite: "cite",
  // Body text → Normal.
  cards: "body",
  card: "body",
  "card text": "body",
  "card (indented)": "body",
  nothing: "body",
  "normal text": "body",
  "evidence text": "body",
  // Character styles — classic template.
  "author-date": "char-cite",
  "debate underline": "char-underline",
  "debate highlighted": "char-underline",
  underline: "char-underline",
  "dotted underline": "char-underline",
  // Character styles — earlier Verbatim distributions.
  "style bold underline": "char-underline",
  "style style bold + 12 pt": "char-cite"
};
var BY_ID = {
  Tags: "tag",
  BlockHeadings: "heading",
  BlockTitle: "heading",
  Cites: "cite",
  Cards: "body",
  Nothing: "body",
  "Author-Date": "char-cite",
  DebateUnderline: "char-underline",
  DebateHighlighted: "char-underline",
  DottedUnderline: "char-underline",
  StyleBoldUnderline: "char-underline",
  StyleStyleBold12pt: "char-cite"
};
var AMBIGUOUS_NAMES = /* @__PURE__ */ new Set(["heading 1", "heading 2", "heading 3", "heading 4"]);
function legacyRole(s) {
  if (s.name != null) {
    const r = BY_NAME[s.name.toLowerCase()];
    if (r) return r;
  }
  if (s.id != null) {
    const r = BY_ID[s.id];
    if (r) return r;
  }
  return void 0;
}
function isUnambiguousLegacy(s) {
  if (legacyRole(s) === void 0) return false;
  return !(s.name != null && AMBIGUOUS_NAMES.has(s.name.toLowerCase()));
}
function buildLegacyHeadingMap(levels, mixedMode) {
  if (mixedMode) {
    return (level) => Math.min(Math.max(level + 1, 1), 5);
  }
  const sorted = [...new Set(levels)].sort((a, b) => b - a);
  const ranked = [3, 2, 1];
  const map = /* @__PURE__ */ new Map();
  sorted.forEach((level, i) => map.set(level, ranked[Math.min(i, ranked.length - 1)]));
  return (level) => map.get(level) ?? 1;
}

// src/import/importer.ts
function importDoc(documentXml, relsXml = null, mediaParts = null, stylesXml = null, notes = null, provenanceOut) {
  const rels = relsXml ? parseRels(relsXml) : {};
  const ctx = {
    rels,
    hyperlinkStack: [],
    fieldStack: [],
    commentRangeStack: [],
    mediaParts,
    footnotes: notes?.footnotes ?? null,
    endnotes: notes?.endnotes ?? null,
    styles: stylesXml ? parseStyles(stylesXml) : /* @__PURE__ */ new Map(),
    legacy: null
  };
  const root = parseXml(documentXml);
  const docEl = findChild(root, "w:document");
  if (!docEl) throw new Error("Missing <w:document> root");
  const body = findChild(children(docEl, "w:document"), "w:body");
  if (!body) throw new Error("Missing <w:body>");
  const bodyChildren = children(body, "w:body");
  ctx.legacy = planLegacy(bodyChildren, ctx.styles);
  const paraIndex = provenanceOut ? new Map(bodyParagraphsInOrder(bodyChildren).map((n, i) => [n, i])) : null;
  const paragraphs = [];
  const collectBlocks = (children2) => {
    for (const node of children2) {
      if ("w:p" in node) {
        const info = parseParagraph(node, ctx);
        if (paraIndex) info.srcPara = paraIndex.get(node) ?? -1;
        paragraphs.push(info);
      } else if ("w:tbl" in node) {
        const tableNode = parseTable(node, ctx);
        if (tableNode) {
          paragraphs.push({
            nodeType: "__rawNode__",
            inlines: [],
            headingId: null,
            pStyle: null,
            indent: 0,
            spacing: null,
            rawNode: tableNode
          });
        }
      } else if ("w:sdt" in node) {
        const content = findChild(children(node, "w:sdt"), "w:sdtContent");
        if (content) collectBlocks(children(content, "w:sdtContent"));
      }
    }
  };
  collectBlocks(bodyChildren);
  return normalizeUnderlineMarks(assembleDoc(paragraphs, provenanceOut));
}
function parseRels(relsXml) {
  const root = parseXml(relsXml);
  const relsEl = findChild(root, "Relationships");
  if (!relsEl) return {};
  const map = {};
  for (const rel of children(relsEl, "Relationships")) {
    if (!("Relationship" in rel)) continue;
    const a = attrs(rel);
    const id = a["Id"];
    const target = a["Target"];
    if (id && target) map[id] = target;
  }
  return map;
}
function parseStyles(stylesXml) {
  const map = /* @__PURE__ */ new Map();
  const raw = /* @__PURE__ */ new Map();
  const root = parseXml(stylesXml);
  const stylesEl = findChild(root, "w:styles");
  if (!stylesEl) return map;
  for (const st of children(stylesEl, "w:styles")) {
    if (!("w:style" in st)) continue;
    const a = attrs(st);
    const id = a["w:styleId"];
    if (!id) continue;
    const type = a["w:type"] ?? null;
    const stChildren = children(st, "w:style");
    const nameEl = findChild(stChildren, "w:name");
    const name = nameEl ? attrs(nameEl)["w:val"] ?? null : null;
    let ownOutline = null;
    const pPrEl = findChild(stChildren, "w:pPr");
    if (pPrEl) {
      const olEl = findChild(children(pPrEl, "w:pPr"), "w:outlineLvl");
      if (olEl) {
        const n = parseInt(attrs(olEl)["w:val"] ?? "", 10);
        if (Number.isFinite(n)) ownOutline = n;
      }
    }
    let ownBold = null;
    const rPrEl = findChild(stChildren, "w:rPr");
    if (rPrEl) {
      const bEl = findChild(children(rPrEl, "w:rPr"), "w:b");
      if (bEl) {
        const v = attrs(bEl)["w:val"];
        ownBold = v !== "0" && v !== "false";
      }
    }
    const basedOnEl = findChild(stChildren, "w:basedOn");
    const basedOn = basedOnEl ? attrs(basedOnEl)["w:val"] ?? null : null;
    map.set(id, { id, name, type, outlineLevel: ownOutline, bold: ownBold });
    raw.set(id, { ownOutline, ownBold, basedOn });
  }
  const memo = /* @__PURE__ */ new Map();
  const resolve4 = (id, stack) => {
    const cached = memo.get(id);
    if (cached) return cached;
    const r = raw.get(id);
    if (!r || stack.has(id)) return { outline: null, bold: null };
    stack.add(id);
    const parent = r.basedOn ? resolve4(r.basedOn, stack) : { outline: null, bold: null };
    stack.delete(id);
    const out = { outline: r.ownOutline ?? parent.outline, bold: r.ownBold ?? parent.bold };
    memo.set(id, out);
    return out;
  };
  for (const [id, info] of map) {
    const eff = resolve4(id, /* @__PURE__ */ new Set());
    info.outlineLevel = eff.outline;
    info.bold = eff.bold;
  }
  return map;
}
function parseParagraph(pNode, ctx) {
  const pChildren = children(pNode, "w:p");
  const pPr = findChild(pChildren, "w:pPr");
  let pStyle = null;
  let indent = 0;
  let spacing = null;
  let numId;
  let ilvl;
  if (pPr) {
    const pPrChildren = children(pPr, "w:pPr");
    const pStyleEl = findChild(pPrChildren, "w:pStyle");
    if (pStyleEl) {
      pStyle = attrs(pStyleEl)["w:val"] ?? null;
    }
    const indEl = findChild(pPrChildren, "w:ind");
    if (indEl) {
      const ia = attrs(indEl);
      const v = ia["w:left"] ?? ia["w:start"];
      const n = v ? parseInt(v, 10) : NaN;
      if (Number.isFinite(n) && n > 0) indent = n;
    }
    const spEl = findChild(pPrChildren, "w:spacing");
    if (spEl) {
      const captured = {};
      for (const [k, v] of Object.entries(attrs(spEl))) {
        if (typeof v === "string") captured[k] = v;
      }
      if (Object.keys(captured).length > 0) spacing = captured;
    }
    const numPrEl = findChild(pPrChildren, "w:numPr");
    if (numPrEl) {
      const numPrChildren = children(numPrEl, "w:numPr");
      const numIdEl = findChild(numPrChildren, "w:numId");
      const idv = numIdEl ? attrs(numIdEl)["w:val"] : void 0;
      const idn = idv ? parseInt(idv, 10) : NaN;
      if (Number.isFinite(idn) && idn > 0) {
        numId = idn;
        const ilvlEl = findChild(numPrChildren, "w:ilvl");
        const lv = ilvlEl ? attrs(ilvlEl)["w:val"] : void 0;
        const ln2 = lv ? parseInt(lv, 10) : 0;
        ilvl = Number.isFinite(ln2) && ln2 > 0 ? ln2 : 0;
      }
    }
  }
  let headingId = null;
  for (const c of pChildren) {
    if ("w:bookmarkStart" in c) {
      const name = attrs(c)["w:name"];
      if (name) {
        const id = idFromBookmarkName(name);
        if (id) {
          headingId = id;
          break;
        }
      }
    }
  }
  const inlines = [];
  for (const c of pChildren) {
    collectInlines(c, ctx, inlines);
  }
  let nodeType = resolveNodeType(pStyle, ctx, pPr);
  if (nodeType === "paragraph") {
    const promoted = outlineHeadingNode(
      pPr,
      pChildren,
      pStyle ? ctx.styles.get(pStyle) : void 0,
      ctx.styles
    );
    if (promoted) nodeType = promoted;
  }
  return { nodeType, inlines, headingId, pStyle, indent, spacing, numId, ilvl };
}
var TCPR_GENERATED_CHILDREN = /* @__PURE__ */ new Set([
  "w:gridSpan",
  "w:vMerge",
  "w:tcW",
  "w:tcPrChange",
  "w:cellIns",
  "w:cellDel",
  "w:cellMerge"
]);
var TBLPR_STRIPPED_CHILDREN = /* @__PURE__ */ new Set([
  "w:tblPrChange"
]);
function parseTable(tblNode, ctx) {
  const rowCells = [];
  const vmergeRestarts = /* @__PURE__ */ new Map();
  let rawTblPr = null;
  const tblPrEl = findChild(children(tblNode, "w:tbl"), "w:tblPr");
  if (tblPrEl) {
    const keep = children(tblPrEl, "w:tblPr").filter((child) => {
      for (const k of Object.keys(child)) {
        if (k === ":@" || k === "#text") continue;
        return !TBLPR_STRIPPED_CHILDREN.has(k);
      }
      return false;
    });
    if (keep.length > 0) rawTblPr = serializeXmlNodes(keep);
  }
  const gridColWidthsPx = [];
  const tblGrid = findChild(children(tblNode, "w:tbl"), "w:tblGrid");
  if (tblGrid) {
    for (const gc of children(tblGrid, "w:tblGrid")) {
      if (!("w:gridCol" in gc)) continue;
      const w = Number(attrs(gc)["w:w"]);
      if (Number.isFinite(w) && w > 0) {
        gridColWidthsPx.push(Math.round(w / 15));
      } else {
        gridColWidthsPx.push(0);
      }
    }
  }
  for (const child of children(tblNode, "w:tbl")) {
    if (!("w:tr" in child)) continue;
    const cells = [];
    let colPos = 0;
    for (const tcChild of children(child, "w:tr")) {
      if (!("w:tc" in tcChild)) continue;
      const tcChildren = children(tcChild, "w:tc");
      const tcPr = findChild(tcChildren, "w:tcPr");
      let colspan = 1;
      let vMergeMode = "none";
      let rawTcPr = null;
      if (tcPr) {
        const tcPrChildren = children(tcPr, "w:tcPr");
        for (const prop of tcPrChildren) {
          if ("w:gridSpan" in prop) {
            const v = Number(attrs(prop)["w:val"] || 1);
            if (Number.isFinite(v) && v > 1) colspan = v;
          } else if ("w:vMerge" in prop) {
            const val = attrs(prop)["w:val"];
            vMergeMode = val === "restart" ? "restart" : "continue";
          }
        }
        const keep = tcPrChildren.filter((child2) => {
          for (const k of Object.keys(child2)) {
            if (k === ":@" || k === "#text") continue;
            return !TCPR_GENERATED_CHILDREN.has(k);
          }
          return false;
        });
        if (keep.length > 0) rawTcPr = serializeXmlNodes(keep);
      }
      if (vMergeMode === "continue") {
        const active = vmergeRestarts.get(colPos);
        if (active) active.rowspan += 1;
        colPos += colspan;
        continue;
      }
      const cellParas = [];
      for (const cellChild of tcChildren) {
        if ("w:p" in cellChild) {
          const para = parseCellParagraph(cellChild, ctx);
          if (para) cellParas.push(para);
        }
      }
      if (cellParas.length === 0) {
        const fallback = schema.nodes["paragraph"].createAndFill();
        if (fallback) cellParas.push(fallback);
      }
      const data = { colspan, rowspan: 1, colPos, rawTcPr, content: cellParas };
      cells.push(data);
      if (vMergeMode === "restart") {
        vmergeRestarts.set(colPos, data);
      } else {
        vmergeRestarts.delete(colPos);
      }
      colPos += colspan;
    }
    if (cells.length > 0) rowCells.push(cells);
  }
  if (rowCells.length === 0) return null;
  const tableType = schema.nodes["table"];
  const rowType = schema.nodes["table_row"];
  const cellType = schema.nodes["table_cell"];
  if (!tableType || !rowType || !cellType) return null;
  const rows = rowCells.map(
    (cells) => rowType.create(
      null,
      cells.map((c) => {
        let colwidth = null;
        if (gridColWidthsPx.length > 0) {
          const slice = gridColWidthsPx.slice(c.colPos, c.colPos + c.colspan);
          if (slice.length === c.colspan && slice.every((w) => w > 0)) {
            colwidth = slice;
          }
        }
        return cellType.create(
          {
            colspan: c.colspan,
            rowspan: c.rowspan,
            colwidth,
            rawTcPr: c.rawTcPr
          },
          c.content
        );
      })
    )
  );
  return tableType.create({ rawTblPr }, rows);
}
function parseCellParagraph(pNode, ctx) {
  const pChildren = children(pNode, "w:p");
  const pPr = findChild(pChildren, "w:pPr");
  let alignment = null;
  if (pPr) {
    const jc = findChild(children(pPr, "w:pPr"), "w:jc");
    if (jc) {
      const v = attrs(jc)["w:val"];
      if (v === "center" || v === "right" || v === "left" || v === "justify") {
        alignment = v;
      } else if (v === "start") {
        alignment = "left";
      } else if (v === "end") {
        alignment = "right";
      }
    }
  }
  const inlines = [];
  for (const c of pChildren) {
    collectInlines(c, ctx, inlines);
  }
  const paragraph = schema.nodes["paragraph"];
  if (!paragraph) return null;
  return paragraph.create({ alignment }, inlines);
}
function collectInlines(node, ctx, out) {
  if ("w:r" in node) {
    parseRun(node, ctx, out);
  } else if ("w:hyperlink" in node) {
    const a = attrs(node);
    const rId = a["r:id"] ?? a["rId"] ?? "";
    if (rId) ctx.hyperlinkStack.push(rId);
    for (const c of children(node, "w:hyperlink")) {
      collectInlines(c, ctx, out);
    }
    if (rId) ctx.hyperlinkStack.pop();
  } else if ("w:ins" in node || "w:moveTo" in node) {
    const tag = "w:ins" in node ? "w:ins" : "w:moveTo";
    for (const c of children(node, tag)) {
      collectInlines(c, ctx, out);
    }
  } else if ("w:del" in node || "w:moveFrom" in node) {
  } else if ("w:commentRangeStart" in node) {
    const id = attrs(node)["w:id"];
    if (id) ctx.commentRangeStack.push(id);
  } else if ("w:commentRangeEnd" in node) {
    const id = attrs(node)["w:id"];
    if (id) {
      const idx = ctx.commentRangeStack.lastIndexOf(id);
      if (idx >= 0) ctx.commentRangeStack.splice(idx, 1);
    }
  }
}
function parseRun(rNode, ctx, out) {
  const rChildren = children(rNode, "w:r");
  const rPrEl = findChild(rChildren, "w:rPr");
  const baseMarks = rPrEl ? [...parseRPr(rPrEl, ctx.styles).marks] : [];
  const currentMarks = () => {
    const m = [...baseMarks];
    if (ctx.hyperlinkStack.length > 0) {
      const top = ctx.hyperlinkStack[ctx.hyperlinkStack.length - 1];
      const href = ctx.rels[top];
      if (href) m.push(schema.marks["link"].create({ href }));
    }
    if (!m.some((x) => x.type.name === "link")) {
      for (let i = ctx.fieldStack.length - 1; i >= 0; i--) {
        const f = ctx.fieldStack[i];
        if (f.phase === "result" && f.hyperlinkHref) {
          m.push(schema.marks["link"].create({ href: f.hyperlinkHref }));
          break;
        }
      }
    }
    for (const threadId of ctx.commentRangeStack) {
      m.push(schema.marks["comment_range"].create({ threadId }));
    }
    return m;
  };
  const inInstrPhase = () => ctx.fieldStack.some((f) => f.phase === "instr");
  for (const c of rChildren) {
    if ("w:fldChar" in c) {
      const t = attrs(c)["w:fldCharType"];
      if (t === "begin") {
        ctx.fieldStack.push({ phase: "instr", instr: "", hyperlinkHref: null });
      } else if (t === "separate") {
        const top = ctx.fieldStack[ctx.fieldStack.length - 1];
        if (top) {
          top.phase = "result";
          const mm = top.instr.match(/HYPERLINK\s+"([^"]*)"/i);
          if (mm) top.hyperlinkHref = mm[1] ?? null;
        }
      } else if (t === "end") {
        ctx.fieldStack.pop();
      }
      continue;
    }
    if ("w:instrText" in c) {
      const top = ctx.fieldStack[ctx.fieldStack.length - 1];
      if (top && top.phase === "instr") top.instr += textContent(c);
      continue;
    }
    if (inInstrPhase()) continue;
    if ("w:t" in c) {
      const text = textContent(c);
      if (text.length > 0) {
        try {
          let effectiveMarks = currentMarks();
          if (text === "\xB6") {
            const sizeIdx = effectiveMarks.findIndex(
              (m) => m.type.name === "font_size" && m.attrs["halfPoints"] === 12
            );
            if (sizeIdx >= 0) {
              effectiveMarks = [
                ...effectiveMarks.slice(0, sizeIdx),
                ...effectiveMarks.slice(sizeIdx + 1),
                schema.marks["pilcrow_marker"].create()
              ];
            }
          }
          out.push(schema.text(text, effectiveMarks));
        } catch (_) {
        }
      }
    } else if ("w:tab" in c) {
      try {
        out.push(schema.text("	", currentMarks()));
      } catch (_) {
      }
    } else if ("w:br" in c) {
      try {
        out.push(schema.text("\n", currentMarks()));
      } catch (_) {
      }
    } else if ("w:noBreakHyphen" in c) {
      try {
        out.push(schema.text("\u2011", currentMarks()));
      } catch (_) {
      }
    } else if ("w:softHyphen" in c) {
      try {
        out.push(schema.text("\xAD", currentMarks()));
      } catch (_) {
      }
    } else if ("w:footnoteReference" in c || "w:endnoteReference" in c) {
      const isEnd = "w:endnoteReference" in c;
      const id = attrs(c)["w:id"] ?? "";
      const map = isEnd ? ctx.endnotes : ctx.footnotes;
      const content = id && map?.get(id) || [];
      let fnNode = schema.nodes["footnote"].create({
        kind: isEnd ? "endnote" : "footnote",
        content
      });
      if (ctx.commentRangeStack.length > 0) {
        fnNode = fnNode.mark(
          ctx.commentRangeStack.map(
            (threadId) => schema.marks["comment_range"].create({ threadId })
          )
        );
      }
      out.push(fnNode);
    } else if ("w:drawing" in c) {
      let imgNode = parseDrawing(c, ctx);
      if (imgNode) {
        if (ctx.commentRangeStack.length > 0) {
          imgNode = imgNode.mark(
            ctx.commentRangeStack.map(
              (threadId) => schema.marks["comment_range"].create({ threadId })
            )
          );
        }
        out.push(imgNode);
      }
    }
  }
}
function parseDrawing(drawingNode, ctx) {
  if (!ctx.mediaParts) return null;
  const blipEmbed = findFirstAttr(drawingNode, "a:blip", "r:embed");
  if (!blipEmbed) return null;
  const target = ctx.rels[blipEmbed];
  if (!target) return null;
  const zipPath = target.startsWith("/") ? target.slice(1) : `word/${target}`;
  const part = ctx.mediaParts.get(zipPath);
  if (!part) return null;
  const cx = parseInt(findFirstAttr(drawingNode, "wp:extent", "cx") ?? "0", 10);
  const cy = parseInt(findFirstAttr(drawingNode, "wp:extent", "cy") ?? "0", 10);
  const altRaw = findFirstAttr(drawingNode, "wp:docPr", "descr") ?? findFirstAttr(drawingNode, "pic:cNvPr", "descr") ?? "";
  const data = bytesToBase64(part.bytes);
  try {
    return schema.nodes["image"].createChecked({
      data,
      contentType: part.contentType,
      widthEmu: Number.isFinite(cx) && cx > 0 ? cx : 0,
      heightEmu: Number.isFinite(cy) && cy > 0 ? cy : 0,
      alt: altRaw
    });
  } catch {
    return null;
  }
}
function findFirstAttr(root, tagName, attr) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    for (const key of Object.keys(node)) {
      if (key === ":@") continue;
      if (key === tagName) {
        const a = attrs(node);
        if (attr in a) return a[attr] ?? null;
      }
      const children2 = node[key];
      if (Array.isArray(children2)) {
        for (const c of children2) {
          if (c && typeof c === "object") stack.push(c);
        }
      }
    }
  }
  return null;
}
function parseRPr(rPr, styles) {
  const marks2 = [];
  const props = children(rPr, "w:rPr");
  let sawDirectU = false;
  let sawItalic = false;
  for (const prop of props) {
    const tag = Object.keys(prop).find((k) => k !== ":@");
    if (!tag) continue;
    const a = attrs(prop);
    switch (tag) {
      case "w:rStyle": {
        const styleId = a["w:val"];
        if (styleId) {
          let markName = RSTYLE_TO_MARK[styleId];
          if (!markName) {
            const role = legacyRole({ id: styleId, name: styles?.get(styleId)?.name ?? null });
            if (role === "char-cite") markName = "cite_mark";
            else if (role === "char-underline") markName = "underline_mark";
          }
          if (markName) marks2.push(schema.marks[markName].create());
        }
        break;
      }
      case "w:b": {
        if (a["w:val"] === "0" || a["w:val"] === "false") {
          marks2.push(schema.marks["bold_off"].create());
        } else {
          marks2.push(schema.marks["bold"].create());
        }
        break;
      }
      case "w:i": {
        if (a["w:val"] !== "0" && a["w:val"] !== "false") {
          sawItalic = true;
        }
        break;
      }
      case "w:strike":
      case "w:dstrike": {
        if (a["w:val"] !== "0" && a["w:val"] !== "false") {
          if (!marks2.some((m) => m.type.name === "strikethrough")) {
            marks2.push(schema.marks["strikethrough"].create());
          }
        }
        break;
      }
      case "w:u": {
        const val = a["w:val"];
        if (val && val !== "none" && val !== "0") {
          sawDirectU = true;
        }
        break;
      }
      case "w:color": {
        const c = a["w:val"];
        if (c && /^[0-9a-fA-F]{6}$/.test(c)) {
          marks2.push(schema.marks["font_color"].create({ color: c }));
        }
        break;
      }
      case "w:sz": {
        const v = a["w:val"];
        const hp = v ? parseInt(v, 10) : NaN;
        if (Number.isFinite(hp) && hp > 0) {
          marks2.push(schema.marks["font_size"].create({ halfPoints: hp }));
        }
        break;
      }
      case "w:highlight": {
        const c = a["w:val"];
        if (c && c !== "none") {
          marks2.push(schema.marks["highlight"].create({ color: c }));
        }
        break;
      }
      case "w:shd": {
        const c = a["w:fill"];
        if (c && /^[0-9a-fA-F]{6}$/.test(c) && c.toLowerCase() !== "auto") {
          marks2.push(schema.marks["shading"].create({ color: c }));
        }
        break;
      }
      case "w:rFonts": {
        const name = a["w:ascii"] || a["w:hAnsi"] || a["w:cs"] || "";
        if (name) {
          marks2.push(schema.marks["font_family"].create({ name }));
        }
        break;
      }
      case "w:vertAlign": {
        const v = a["w:val"];
        if (v === "superscript") {
          marks2.push(schema.marks["superscript"].create());
        } else if (v === "subscript") {
          marks2.push(schema.marks["subscript"].create());
        }
        break;
      }
    }
  }
  if (sawDirectU && !marks2.some((m) => m.type.name === "underline_mark")) {
    marks2.push(schema.marks["underline_direct"].create());
  }
  if (sawItalic && !marks2.some((m) => m.type.name === "undertag_mark")) {
    marks2.push(schema.marks["italic"].create());
  }
  return { marks: marks2 };
}
var HEADING_LEVEL_NODE = {
  1: "pocket",
  2: "hat",
  3: "block",
  4: "tag",
  5: "block"
};
function hasVerbatimStyles(styles) {
  const ids = /* @__PURE__ */ new Set();
  const names = /* @__PURE__ */ new Set();
  for (const s of styles.values()) {
    ids.add(s.id);
    if (s.name) names.add(s.name);
  }
  const groups = [
    ["Style13ptBold", "Style 13 pt Bold"],
    ["StyleUnderline", "Style Underline"],
    ["Emphasis"]
  ];
  return groups.every((vs) => vs.some((v) => ids.has(v) || names.has(v)));
}
function paragraphOutline(pPr, info) {
  if (pPr) {
    const olEl = findChild(children(pPr, "w:pPr"), "w:outlineLvl");
    if (olEl) {
      const n = parseInt(attrs(olEl)["w:val"] ?? "", 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return info?.outlineLevel ?? -1;
}
function runBoldState(rPr) {
  if (!rPr) return null;
  const b = findChild(children(rPr, "w:rPr"), "w:b");
  if (!b) return null;
  const v = attrs(b)["w:val"];
  return v !== "0" && v !== "false";
}
function runSizePt(rPr) {
  if (!rPr) return null;
  const sz = findChild(children(rPr, "w:rPr"), "w:sz");
  if (!sz) return null;
  const n = parseInt(attrs(sz)["w:val"] ?? "", 10);
  return Number.isFinite(n) ? n / 2 : null;
}
function runUnderlined(rPr) {
  if (!rPr) return false;
  const u = findChild(children(rPr, "w:rPr"), "w:u");
  if (!u) return false;
  return (attrs(u)["w:val"] ?? "single") !== "none";
}
function runCharStyle(rPr) {
  if (!rPr) return null;
  const rs = findChild(children(rPr, "w:rPr"), "w:rStyle");
  return rs ? attrs(rs)["w:val"] ?? null : null;
}
function paragraphEffectivelyBold(pChildren, pInfo, styles) {
  const pStyleBold = pInfo?.bold ?? false;
  for (const c of pChildren) {
    if (!("w:r" in c)) continue;
    const rPr = findChild(children(c, "w:r"), "w:rPr");
    const direct = runBoldState(rPr);
    if (direct === true) return true;
    if (direct === false) continue;
    const rStyle = runCharStyle(rPr);
    const charBold = rStyle ? styles.get(rStyle)?.bold ?? false : false;
    if (charBold || pStyleBold) return true;
  }
  return false;
}
function outlineHeadingNode(pPr, pChildren, info, styles) {
  const outline = paragraphOutline(pPr, info);
  if (outline < 0 || outline > 3) return null;
  const rPrs = pChildren.filter((c) => "w:r" in c).map((r) => findChild(children(r, "w:r"), "w:rPr"));
  const anyRun = (pred) => rPrs.some(pred);
  if (outline === 0)
    return anyRun((r) => runBoldState(r) === true && runSizePt(r) === 26) ? "pocket" : null;
  if (outline === 1)
    return anyRun((r) => runBoldState(r) === true && runSizePt(r) === 22) ? "hat" : null;
  if (outline === 2)
    return anyRun((r) => runBoldState(r) === true && runUnderlined(r) && runSizePt(r) === 16) ? "block" : null;
  return paragraphEffectivelyBold(pChildren, info, styles) ? "tag" : null;
}
function planLegacy(bodyChildren, styles) {
  let tripped = false;
  const headingLevels = /* @__PURE__ */ new Set();
  for (const node of bodyChildren) {
    if (!("w:p" in node)) continue;
    const pPr = findChild(children(node, "w:p"), "w:pPr");
    const pStyleEl = pPr ? findChild(children(pPr, "w:pPr"), "w:pStyle") : null;
    const pStyle = pStyleEl ? attrs(pStyleEl)["w:val"] ?? null : null;
    if (!pStyle) continue;
    const info = styles.get(pStyle);
    const lookup = { name: info?.name ?? null, id: pStyle };
    const role = legacyRole(lookup);
    if (!role) continue;
    if (isUnambiguousLegacy(lookup)) tripped = true;
    if (role === "heading") headingLevels.add(paragraphOutline(pPr, info));
  }
  if (!tripped) return null;
  const levelFor = buildLegacyHeadingMap(headingLevels, hasVerbatimStyles(styles));
  return {
    headingNode: (outline) => HEADING_LEVEL_NODE[levelFor(outline)] ?? "block"
  };
}
function resolveNodeType(pStyle, ctx, pPr) {
  const info = pStyle ? ctx.styles.get(pStyle) : void 0;
  if (ctx.legacy && pStyle) {
    const role = legacyRole({ name: info?.name ?? null, id: pStyle });
    if (role === "tag") return "tag";
    if (role === "heading") return ctx.legacy.headingNode(paragraphOutline(pPr, info));
    if (role === "cite" || role === "body") return "paragraph";
  }
  if (pStyle && pStyle in PSTYLE_TO_NODE) {
    return PSTYLE_TO_NODE[pStyle];
  }
  if (pStyle) {
    const fallback = fallbackNodeType(info ?? { id: pStyle, name: null, type: null });
    if (fallback) return fallback;
  }
  return "paragraph";
}
function assembleDoc(paragraphs, provenance) {
  const docNodes = [];
  const cardNumInfo = /* @__PURE__ */ new Map();
  let i = 0;
  while (i < paragraphs.length) {
    const para = paragraphs[i];
    if (para.rawNode) {
      docNodes.push(para.rawNode);
      i++;
      continue;
    }
    if (para.nodeType === "analytic") {
      const analyticAttrs = attrsForHeading(para.headingId);
      recordProvenance(provenance, analyticAttrs.id, para);
      const analyticNode = schema.nodes["analytic"].create(
        withIndent(analyticAttrs, para),
        para.inlines
      );
      const unitChildren = [analyticNode];
      let j = i + 1;
      while (j < paragraphs.length && paragraphs[j].nodeType === "undertag") {
        const u = paragraphs[j];
        unitChildren.push(
          schema.nodes["undertag"].create(withIndent(null, u), u.inlines)
        );
        j++;
      }
      while (j < paragraphs.length) {
        const p = paragraphs[j];
        if (p.nodeType === "paragraph") {
          const slot = hasCiteMark(p.inlines) ? "cite_paragraph" : "card_body";
          unitChildren.push(schema.nodes[slot].create(withIndent(null, p), p.inlines));
          j++;
          continue;
        }
        if (p.rawNode && p.rawNode.type.name === "table") {
          unitChildren.push(p.rawNode);
          j++;
          continue;
        }
        break;
      }
      try {
        const unitNode = schema.nodes["analytic_unit"].createChecked(null, unitChildren);
        docNodes.push(unitNode);
        if (para.numId != null) {
          cardNumInfo.set(unitNode, { numId: para.numId, ilvl: para.ilvl ?? 0 });
        }
      } catch (_e) {
        for (const child of unitChildren) {
          docNodes.push(coerceToDocChild(child));
        }
      }
      i = j;
      continue;
    }
    if (para.nodeType === "tag") {
      const tagAttrs = attrsForHeading(para.headingId);
      recordProvenance(provenance, tagAttrs.id, para);
      const tagNode = schema.nodes["tag"].create(
        withIndent(tagAttrs, para),
        para.inlines
      );
      const cardChildren = [tagNode];
      let j = i + 1;
      while (j < paragraphs.length && paragraphs[j].nodeType === "undertag") {
        const u = paragraphs[j];
        cardChildren.push(
          schema.nodes["undertag"].create(withIndent(null, u), u.inlines)
        );
        j++;
      }
      while (j < paragraphs.length) {
        const p = paragraphs[j];
        if (p.nodeType === "paragraph") {
          const slot = hasCiteMark(p.inlines) ? "cite_paragraph" : "card_body";
          cardChildren.push(schema.nodes[slot].create(withIndent(null, p), p.inlines));
          j++;
          continue;
        }
        if (p.rawNode && p.rawNode.type.name === "table") {
          cardChildren.push(p.rawNode);
          j++;
          continue;
        }
        break;
      }
      try {
        const cardNode = schema.nodes["card"].createChecked(null, cardChildren);
        docNodes.push(cardNode);
        if (para.numId != null) {
          cardNumInfo.set(cardNode, { numId: para.numId, ilvl: para.ilvl ?? 0 });
        }
      } catch (_e) {
        for (const child of cardChildren) {
          docNodes.push(coerceToDocChild(child));
        }
      }
      i = j;
    } else {
      const node = paragraphToNode(para);
      if (node) {
        if (HEADING_TYPE_NAMES.has(node.type.name)) {
          recordProvenance(provenance, node.attrs.id, para);
        }
        docNodes.push(node);
      }
      i++;
    }
  }
  const numbered = reconstructNumbering(docNodes, cardNumInfo);
  try {
    return schema.nodes["doc"].createChecked(null, numbered);
  } catch (_e) {
    return schema.nodes["doc"].createChecked(
      null,
      numbered.map((n) => coerceToDocChild(n))
    );
  }
}
function reconstructNumbering(nodes2, cardNumInfo) {
  if (cardNumInfo.size === 0) return nodes2;
  const role = /* @__PURE__ */ new Map();
  const cardRestart = /* @__PURE__ */ new Set();
  const blockContinue = /* @__PURE__ */ new Set();
  let lastNumId = null;
  let pendingBlocks = [];
  for (let k = 0; k < nodes2.length; k++) {
    const t = nodes2[k].type.name;
    if (t === "pocket" || t === "hat") {
      pendingBlocks = [];
      lastNumId = null;
      continue;
    }
    if (t === "block") {
      pendingBlocks.push(k);
      continue;
    }
    if (t === "card" || t === "analytic_unit") {
      const info = cardNumInfo.get(nodes2[k]);
      if (!info) continue;
      role.set(k, info.ilvl === 0 ? "number" : "sub");
      if (lastNumId !== null) {
        if (info.numId === lastNumId) {
          for (const b of pendingBlocks) blockContinue.add(b);
        } else if (pendingBlocks.length === 0) {
          cardRestart.add(k);
        }
      }
      lastNumId = info.numId;
      pendingBlocks = [];
    }
  }
  if (role.size === 0 && cardRestart.size === 0 && blockContinue.size === 0) return nodes2;
  return nodes2.map((n, k) => {
    const t = n.type.name;
    if (t === "card" || t === "analytic_unit") {
      const r = role.get(k);
      const restart = cardRestart.has(k);
      if (r || restart) {
        return n.type.create({ ...n.attrs, numRole: r ?? "none", numRestart: restart }, n.content, n.marks);
      }
    } else if (t === "block" && blockContinue.has(k)) {
      return n.type.create({ ...n.attrs, numRestart: false }, n.content, n.marks);
    }
    return n;
  });
}
function hasCiteMark(inlines) {
  for (const n of inlines) {
    if (n.isText && (!n.text || !n.text.trim())) continue;
    if (n.marks.some((m) => m.type.name === "cite_mark")) return true;
  }
  return false;
}
function attrsForHeading(id) {
  return { id: id ?? newHeadingId() };
}
function recordProvenance(provenance, headingId, para) {
  if (provenance && headingId && para.srcPara != null && para.srcPara >= 0) {
    provenance.set(headingId, para.srcPara);
  }
}
function withIndent(base2, para) {
  const hasIndent = para.indent && para.indent > 0;
  const hasSpacing = para.spacing && Object.keys(para.spacing).length > 0;
  if (!hasIndent && !hasSpacing) return base2;
  const out = { ...base2 ?? {} };
  if (hasIndent) out["indent"] = para.indent;
  if (hasSpacing) out["spacing"] = para.spacing;
  return out;
}
function paragraphToNode(para) {
  const effectiveType = para.nodeType === "paragraph" && hasCiteMark(para.inlines) ? "cite_paragraph" : para.nodeType;
  const nodeType = schema.nodes[effectiveType];
  if (!nodeType) return null;
  const isHeading = ["pocket", "hat", "block", "tag", "analytic"].includes(effectiveType);
  const baseAttrs = isHeading ? attrsForHeading(para.headingId) : {};
  const attrs2 = { ...baseAttrs };
  if (para.indent > 0) attrs2["indent"] = para.indent;
  if (para.spacing && Object.keys(para.spacing).length > 0) {
    attrs2["spacing"] = para.spacing;
  }
  try {
    return nodeType.createChecked(attrs2, para.inlines);
  } catch (_e) {
    return null;
  }
}
function coerceToDocChild(node) {
  if (node.type.name === "tag") {
    return schema.nodes["card"].createChecked(null, [node]);
  }
  if (node.type.name === "analytic") {
    return schema.nodes["analytic_unit"].createChecked(null, [node]);
  }
  return node;
}

// src/import/comments.ts
function importComments(commentsXml, commentsExtendedXml) {
  if (!commentsXml) return [];
  const raws = /* @__PURE__ */ new Map();
  const root = parseXml(commentsXml);
  const commentsEl = findChild(root, "w:comments");
  if (!commentsEl) return [];
  for (const node of children(commentsEl, "w:comments")) {
    if (!("w:comment" in node)) continue;
    const a = attrs(node);
    const id = a["w:id"];
    if (!id) continue;
    const children2 = children(node, "w:comment");
    const firstP = children2.find((c) => "w:p" in c);
    const paraId = firstP ? attrs(firstP)["w14:paraId"] ?? null : null;
    raws.set(id, {
      id,
      author: a["w:author"] ?? "",
      initials: a["w:initials"] ?? "",
      date: a["w:date"] ?? "",
      // Plain-text body for now — strip formatting. Multi-paragraph
      // comments collapse to newline-separated plain text.
      text: extractCommentText(node),
      paraId
    });
  }
  const parentByParaId = /* @__PURE__ */ new Map();
  if (commentsExtendedXml) {
    const extRoot = parseXml(commentsExtendedXml);
    const walk2 = (nodes2) => {
      for (const n of nodes2) {
        for (const key of Object.keys(n)) {
          if (key === ":@" || key === "#text") continue;
          if (key.endsWith(":commentEx")) {
            const ea = attrs(n);
            const paraId = ea["w15:paraId"] ?? ea["paraId"];
            const parentId = ea["w15:paraIdParent"] ?? ea["paraIdParent"];
            if (paraId && parentId) parentByParaId.set(paraId, parentId);
          }
          const value = n[key];
          if (Array.isArray(value)) walk2(value);
        }
      }
    };
    walk2(extRoot);
  }
  const commentIdByParaId = /* @__PURE__ */ new Map();
  for (const r of raws.values()) {
    if (r.paraId) commentIdByParaId.set(r.paraId, r.id);
  }
  const parentCommentId = (raw) => {
    if (!raw.paraId) return null;
    const parentParaId = parentByParaId.get(raw.paraId);
    if (!parentParaId) return null;
    return commentIdByParaId.get(parentParaId) ?? null;
  };
  const rootOf = (raw) => {
    let current = raw;
    const seen = /* @__PURE__ */ new Set();
    while (true) {
      const pid = parentCommentId(current);
      if (!pid || seen.has(pid)) return current.id;
      seen.add(pid);
      const next = raws.get(pid);
      if (!next) return current.id;
      current = next;
    }
  };
  const threadsByRoot = /* @__PURE__ */ new Map();
  for (const raw of raws.values()) {
    const rootId = rootOf(raw);
    const pid = parentCommentId(raw);
    const comment = {
      id: raw.id,
      author: raw.author,
      initials: raw.initials,
      date: raw.date,
      text: raw.text,
      kind: "human",
      parentId: pid
    };
    const list = threadsByRoot.get(rootId) ?? [];
    list.push(comment);
    threadsByRoot.set(rootId, list);
  }
  const out = [];
  for (const [rootId, comments] of threadsByRoot) {
    comments.sort((a, b) => {
      if (a.id === rootId) return -1;
      if (b.id === rootId) return 1;
      const ad = a.date || "";
      const bd = b.date || "";
      if (ad !== bd) return ad < bd ? -1 : 1;
      return Number(a.id) - Number(b.id);
    });
    out.push({ id: rootId, comments });
  }
  return out;
}
function extractCommentText(commentNode) {
  const paragraphs = [];
  for (const c of children(commentNode, "w:comment")) {
    if (!("w:p" in c)) continue;
    paragraphs.push(textContent(c));
  }
  return paragraphs.join("\n");
}

// src/import/footnotes.ts
function parseRelTargets(relsXml) {
  const out = /* @__PURE__ */ new Map();
  if (!relsXml) return out;
  const root = parseXml(relsXml);
  const rels = findChild(root, "Relationships");
  if (!rels) return out;
  for (const child of children(rels, "Relationships")) {
    if (!("Relationship" in child)) continue;
    const a = attrs(child);
    const id = a["Id"];
    const target = a["Target"];
    if (id && target) out.set(id, target);
  }
  return out;
}
function flattenRun(rNode, link) {
  const children2 = children(rNode, "w:r");
  let text = "";
  let bold = false;
  let italic = false;
  let underline = false;
  for (const c of children2) {
    if ("w:t" in c) {
      text += textContent(c);
    } else if ("w:tab" in c) {
      text += "	";
    } else if ("w:br" in c) {
      text += "\n";
    } else if ("w:rPr" in c) {
      for (const p of children(c, "w:rPr")) {
        if ("w:b" in p && attrs(p)["w:val"] !== "0" && attrs(p)["w:val"] !== "false") bold = true;
        if ("w:i" in p && attrs(p)["w:val"] !== "0" && attrs(p)["w:val"] !== "false") italic = true;
        if ("w:u" in p && attrs(p)["w:val"] !== "none") underline = true;
      }
    }
  }
  if (text.length === 0) return null;
  const run = { text };
  if (bold) run.bold = true;
  if (italic) run.italic = true;
  if (underline) run.underline = true;
  if (link) run.link = link;
  return run;
}
function flattenParagraph(pNode, rels) {
  const runs = [];
  let sawMarker = false;
  const walkInline = (nodes2, link) => {
    for (const c of nodes2) {
      if ("w:r" in c) {
        for (const rc of children(c, "w:r")) {
          if ("w:footnoteRef" in rc || "w:endnoteRef" in rc) sawMarker = true;
        }
        const run = flattenRun(c, link);
        if (run) runs.push(run);
      } else if ("w:hyperlink" in c) {
        const rId = attrs(c)["r:id"];
        const target = rId ? rels.get(rId) : void 0;
        walkInline(children(c, "w:hyperlink"), target ?? link);
      }
    }
  };
  walkInline(children(pNode, "w:p"), void 0);
  if (sawMarker) {
    while (runs.length > 0 && runs[0].text.trim().length === 0) runs.shift();
    if (runs.length > 0) {
      const first = runs[0];
      runs[0] = { ...first, text: first.text.replace(/^\s+/, "") };
    }
  }
  return runs;
}
function importNotes(notesXml, notesRelsXml, rootTag, noteTag) {
  const out = /* @__PURE__ */ new Map();
  if (!notesXml) return out;
  const rels = parseRelTargets(notesRelsXml);
  const root = parseXml(notesXml);
  const notesEl = findChild(root, rootTag);
  if (!notesEl) return out;
  for (const child of children(notesEl, rootTag)) {
    if (!(noteTag in child)) continue;
    const a = attrs(child);
    const type = a["w:type"];
    if (type === "separator" || type === "continuationSeparator" || type === "continuationNotice") {
      continue;
    }
    const id = a["w:id"];
    if (!id) continue;
    const paragraphs = [];
    for (const inner of children(child, noteTag)) {
      if ("w:p" in inner) {
        const runs = flattenParagraph(inner, rels);
        if (runs.length > 0) paragraphs.push(runs);
      }
    }
    out.set(id, paragraphs);
  }
  return out;
}

// src/import/index.ts
var IMAGE_CONTENT_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
  // Windows metafile formats — common in Word docs (vector graphics
  // pasted from Excel, PowerPoint, etc.).
  emf: "image/x-emf",
  wmf: "image/x-wmf"
};
function inferContentType(path) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_CONTENT_TYPES[ext] ?? "application/octet-stream";
}
function checkImportedDoc(doc) {
  try {
    doc.check();
  } catch (err3) {
    throw new Error(
      `This Word document imported into an invalid structure \u2014 please report this file (${err3 instanceof Error ? err3.message : String(err3)}).`
    );
  }
  return doc;
}
async function fromDocxFull(bytes) {
  const docx = await Docx.load(bytes);
  const documentXml = await docx.readText("word/document.xml");
  if (!documentXml) throw new Error("docx is missing word/document.xml");
  const relsXml = await docx.readText("word/_rels/document.xml.rels");
  const stylesXml = await docx.readText("word/styles.xml");
  const mediaParts = /* @__PURE__ */ new Map();
  for (const path of docx.paths()) {
    if (!path.startsWith("word/media/")) continue;
    const partBytes = await docx.readBinary(path);
    if (!partBytes) continue;
    const part = {
      bytes: partBytes,
      contentType: inferContentType(path)
    };
    mediaParts.set(path, part);
  }
  const footnotesXml = await docx.readText("word/footnotes.xml");
  const endnotesXml = await docx.readText("word/endnotes.xml");
  const footnotesRelsXml = await docx.readText("word/_rels/footnotes.xml.rels");
  const endnotesRelsXml = await docx.readText("word/_rels/endnotes.xml.rels");
  const doc = checkImportedDoc(
    repairDoc(
      importDoc(documentXml, relsXml, mediaParts, stylesXml, {
        footnotes: importNotes(footnotesXml, footnotesRelsXml, "w:footnotes", "w:footnote"),
        endnotes: importNotes(endnotesXml, endnotesRelsXml, "w:endnotes", "w:endnote")
      })
    )
  );
  const commentsXml = await docx.readText("word/comments.xml");
  const commentsExtendedXml = await docx.readText("word/commentsExtended.xml");
  const threads = importComments(commentsXml, commentsExtendedXml);
  const docId = await docx.readDocId();
  return { doc, threads, docId };
}

// src/schema/footnotes.ts
function footnotePlainText(content) {
  return content.map((para) => para.map((r) => r.text).join("")).join("\n");
}

// src/tools/cardmirror-read-lib.ts
async function toUncompressedJson(bytes, kind) {
  if (kind === "cmir") {
    const raw = isGzip(bytes) ? gunzip(bytes) : bytes;
    const text = new TextDecoder().decode(raw);
    return JSON.stringify(JSON.parse(text), null, 2) + "\n";
  }
  const { doc, threads, docId } = await fromDocxFull(bytes);
  const envelope = serializeNative(doc, {
    threads,
    docId: docId ?? void 0,
    appVersion: "cardmirror-read"
  });
  return JSON.stringify(JSON.parse(new TextDecoder().decode(gunzip(envelope))), null, 2) + "\n";
}
async function parseToDoc(bytes, kind) {
  if (kind === "cmir") return parseNative(bytes).doc;
  return (await fromDocxFull(bytes)).doc;
}
function inlineText(node) {
  const segs = [];
  node.forEach((child) => {
    if (child.isText) {
      const names = child.marks.map((m) => m.type.name);
      const w = names.includes("highlight") || names.includes("shading") ? "highlight" : names.includes("underline_mark") ? "underline" : names.includes("emphasis_mark") ? "emphasis" : "plain";
      segs.push({ t: child.text ?? "", w });
    } else if (child.type.name === "footnote") {
      const note = footnotePlainText(child.attrs["content"] ?? []).trim();
      if (note) segs.push({ t: ` [note: ${note}]`, w: "plain" });
    } else if (child.type.name === "image") {
      segs.push({ t: "[image]", w: "plain" });
    } else {
      const t = child.textContent;
      if (t) segs.push({ t, w: "plain" });
    }
  });
  const merged = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && last.w === s.w) last.t += s.t;
    else merged.push({ ...s });
  }
  const WRAPPERS = {
    highlight: ["==", "=="],
    underline: ["__", "__"],
    emphasis: ["*", "*"],
    plain: ["", ""]
  };
  return merged.map(({ t, w }) => {
    if (w === "plain" || t.trim() === "") return t;
    const lead = t.match(/^\s*/)[0];
    const trail = t.match(/\s*$/)[0];
    const core = t.slice(lead.length, t.length - trail.length);
    const [o, c] = WRAPPERS[w];
    return `${lead}${o}${core}${c}${trail}`;
  }).join("");
}
function renderTable(node, out) {
  node.forEach((row) => {
    const cells = [];
    row.forEach((cell) => {
      const parts = [];
      cell.forEach((p) => parts.push(inlineText(p)));
      cells.push(parts.join(" ").trim());
    });
    out.push(`| ${cells.join(" | ")} |`);
  });
  out.push("");
}
function renderBlock(node, out) {
  const name = node.type.name;
  switch (name) {
    case "pocket":
      out.push(`# ${inlineText(node)}`, "");
      return;
    case "hat":
      out.push(`## ${inlineText(node)}`, "");
      return;
    case "block":
      out.push(`### ${inlineText(node)}`, "");
      return;
    case "card":
    case "analytic_unit": {
      node.forEach((child, _off, i) => {
        const cn = child.type.name;
        if (i === 0) {
          const suffix = name === "analytic_unit" ? " _(analytic)_" : "";
          out.push(`#### ${inlineText(child)}${suffix}`);
        } else if (cn === "cite_paragraph") {
          out.push(`Cite: ${inlineText(child)}`);
        } else if (cn === "undertag") {
          out.push(`> ${inlineText(child)}`);
        } else if (cn === "table") {
          renderTable(child, out);
        } else {
          const t = inlineText(child);
          if (t.trim() !== "") out.push(t);
        }
      });
      out.push("");
      return;
    }
    case "paragraph":
    case "card_body":
    case "cite_paragraph":
    case "undertag": {
      const t = inlineText(node);
      if (t.trim() !== "") out.push(t, "");
      return;
    }
    case "table":
      renderTable(node, out);
      return;
    default: {
      if (node.childCount > 0 && !node.isTextblock) {
        out.push(`[transcluded content (${name}) \u2014 cached copy of another document's cards:]`, "");
        node.forEach((child) => renderBlock(child, out));
        out.push("[end transcluded content]", "");
        return;
      }
      const t = node.textContent;
      if (t.trim() !== "") out.push(t, "");
    }
  }
}
function renderPlainText(doc, sourceName) {
  const out = [
    `> Read-only plain-text rendering of "${sourceName}" (via cardmirror-read).`,
    `> Layers: ==highlighted== (read aloud) \xB7 __underlined__ \xB7 *emphasis*.`,
    `> Structure: # Pocket \xB7 ## Hat \xB7 ### Block \xB7 #### Tag / analytic heading; "Cite:" lines carry the citation.`,
    ""
  ];
  doc.forEach((child) => renderBlock(child, out));
  const collapsed = [];
  for (const line of out) {
    if (line === "" && collapsed[collapsed.length - 1] === "") continue;
    collapsed.push(line);
  }
  return collapsed.join("\n").trimEnd() + "\n";
}

// src/tools/cardmirror-read-mirror.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var CONVERTIBLE = /* @__PURE__ */ new Set([".cmir", ".docx"]);
function planSources(roots) {
  if (roots.length === 1) return [{ root: roots[0], prefix: "" }];
  const used = /* @__PURE__ */ new Map();
  return roots.map((root) => {
    const base2 = (0, import_node_path.basename)(root) || "root";
    const n = used.get(base2) ?? 0;
    used.set(base2, n + 1);
    return { root, prefix: n === 0 ? base2 : `${base2}-${n + 1}` };
  });
}
function shadowPathFor(src, outDir, filePath) {
  const ext = (0, import_node_path.extname)(filePath).toLowerCase();
  if (!CONVERTIBLE.has(ext)) return null;
  const rel = (0, import_node_path.relative)(src.root, filePath);
  if (rel.startsWith("..")) return null;
  const relTxt = rel.slice(0, rel.length - ext.length) + ".txt";
  return (0, import_node_path.join)(outDir, src.prefix, relTxt);
}
function isRenderable(name) {
  if (name.startsWith(".") || name.startsWith("~$")) return false;
  return CONVERTIBLE.has((0, import_node_path.extname)(name).toLowerCase());
}
async function renderOne(filePath, target) {
  const ext = (0, import_node_path.extname)(filePath).toLowerCase();
  const kind = ext === ".docx" ? "docx" : "cmir";
  const bytes = new Uint8Array((0, import_node_fs.readFileSync)(filePath));
  const doc = await parseToDoc(bytes, kind);
  const text = renderPlainText(doc, (0, import_node_path.basename)(filePath));
  (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(target), { recursive: true });
  if ((0, import_node_fs.existsSync)(target)) (0, import_node_fs.chmodSync)(target, 420);
  (0, import_node_fs.writeFileSync)(target, text);
  (0, import_node_fs.chmodSync)(target, 292);
}
function* walkFiles(dir) {
  let entries;
  try {
    entries = (0, import_node_fs.readdirSync)(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = (0, import_node_path.join)(dir, ent.name);
    if (ent.isDirectory()) yield* walkFiles(full);
    else if (ent.isFile() && isRenderable(ent.name)) yield full;
  }
}
async function sweepSource(src, outDir, log) {
  let rendered = 0;
  let skipped = 0;
  let removed = 0;
  let failed = 0;
  const liveShadows = /* @__PURE__ */ new Set();
  for (const file of walkFiles(src.root)) {
    const target = shadowPathFor(src, outDir, file);
    if (!target) continue;
    liveShadows.add((0, import_node_path.resolve)(target));
    try {
      const srcM = (0, import_node_fs.statSync)(file).mtimeMs;
      const outM = (0, import_node_fs.existsSync)(target) ? (0, import_node_fs.statSync)(target).mtimeMs : -1;
      if (outM >= srcM) {
        skipped++;
        continue;
      }
      await renderOne(file, target);
      rendered++;
      log(`rendered ${(0, import_node_path.relative)(src.root, file)}`);
    } catch (err3) {
      failed++;
      log(`FAILED ${(0, import_node_path.relative)(src.root, file)}: ${err3 instanceof Error ? err3.message : err3}`);
    }
  }
  const shadowRoot = (0, import_node_path.join)(outDir, src.prefix);
  for (const shadow of walkTxt(shadowRoot)) {
    if (!liveShadows.has((0, import_node_path.resolve)(shadow))) {
      try {
        (0, import_node_fs.chmodSync)(shadow, 420);
        (0, import_node_fs.rmSync)(shadow);
        removed++;
        log(`removed orphan ${(0, import_node_path.relative)(outDir, shadow)}`);
      } catch {
      }
    }
  }
  return { rendered, skipped, removed, failed };
}
function* walkTxt(dir) {
  let entries;
  try {
    entries = (0, import_node_fs.readdirSync)(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = (0, import_node_path.join)(dir, ent.name);
    if (ent.isDirectory()) yield* walkTxt(full);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith(".txt")) yield full;
  }
}
async function runMirror(roots, outDir) {
  const sources = planSources(roots.map((r) => (0, import_node_path.resolve)(r)));
  const out = (0, import_node_path.resolve)(outDir);
  (0, import_node_fs.mkdirSync)(out, { recursive: true });
  const log = (line) => {
    process.stdout.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${line}
`);
  };
  log(`mirroring ${sources.length} source(s) \u2192 ${out}`);
  for (const src of sources) {
    const r = await sweepSource(src, out, log);
    log(
      `${src.root}: ${r.rendered} rendered, ${r.skipped} current, ${r.removed} orphans removed` + (r.failed ? `, ${r.failed} FAILED` : "")
    );
  }
  const watchers = [];
  const timers = /* @__PURE__ */ new Map();
  for (const src of sources) {
    const schedule = () => {
      const prev = timers.get(src.root);
      if (prev) clearTimeout(prev);
      timers.set(
        src.root,
        setTimeout(() => {
          void sweepSource(src, out, log);
        }, 1500)
      );
    };
    try {
      watchers.push((0, import_node_fs.watch)(src.root, { recursive: true }, schedule));
      log(`watching ${src.root}`);
    } catch (err3) {
      log(`WATCH FAILED for ${src.root} (${err3 instanceof Error ? err3.message : err3}) \u2014 falling back to 60s polling`);
      setInterval(schedule, 6e4);
    }
  }
  process.on("SIGINT", () => {
    for (const w of watchers) w.close();
    process.exit(0);
  });
  return new Promise(() => {
  });
}

// src/tools/cardmirror-read-mcp.ts
var import_node_fs2 = require("node:fs");
var import_node_http = require("node:http");
var import_node_path2 = require("node:path");
var PROTOCOL_VERSION = "2025-06-18";
var SERVER_INFO = { name: "cardmirror-read", version: "1.0.0" };
var TEXT_CAP = 4e5;
var JSON_CAP = 2e6;
var CONVERTIBLE2 = /* @__PURE__ */ new Set([".cmir", ".docx"]);
function ok(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}
function err2(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}
function toolText(id, text, isError = false) {
  return ok(id, { content: [{ type: "text", text }], isError });
}
var TOOLS = [
  {
    name: "list_debate_files",
    description: "List CardMirror (.cmir) and Word (.docx) debate files under the configured folders. Returns relative paths usable with read_debate_file. Optional substring filter.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Case-insensitive substring to filter paths (optional)."
        }
      }
    }
  },
  {
    name: "read_debate_file",
    description: "Read one debate file as text. `path` is a path returned by list_debate_files (or an absolute path inside a configured folder). `form` is 'text' (default: legible markdown-flavored rendering \u2014 ==highlighted== is the read-aloud layer) or 'json' (full-fidelity uncompressed CardMirror envelope; can be very large).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File to read." },
        form: { type: "string", enum: ["text", "json"], description: "Output form (default 'text')." }
      },
      required: ["path"]
    }
  }
];
function resolveWithinRoots(roots, p) {
  const candidates = p.startsWith("/") ? [p] : roots.map((r) => (0, import_node_path2.join)(r, p));
  for (const cand of candidates) {
    let real;
    try {
      real = (0, import_node_fs2.realpathSync)((0, import_node_path2.resolve)(cand));
    } catch {
      continue;
    }
    for (const root of roots) {
      let realRoot;
      try {
        realRoot = (0, import_node_fs2.realpathSync)(root);
      } catch {
        continue;
      }
      if (real === realRoot || real.startsWith(realRoot + import_node_path2.sep)) return real;
    }
  }
  return null;
}
function* walkFiles2(dir) {
  let entries;
  try {
    entries = (0, import_node_fs2.readdirSync)(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".") || ent.name.startsWith("~$")) continue;
    const full = (0, import_node_path2.join)(dir, ent.name);
    if (ent.isDirectory()) yield* walkFiles2(full);
    else if (ent.isFile() && CONVERTIBLE2.has((0, import_node_path2.extname)(ent.name).toLowerCase())) yield full;
  }
}
async function callTool(roots, id, name, args) {
  if (name === "list_debate_files") {
    const query = typeof args["query"] === "string" ? args["query"].toLowerCase() : null;
    const lines = [];
    for (const root of roots) {
      for (const file of walkFiles2(root)) {
        const rel = roots.length === 1 ? (0, import_node_path2.relative)(root, file) : (0, import_node_path2.join)((0, import_node_path2.basename)(root), (0, import_node_path2.relative)(root, file));
        if (query && !rel.toLowerCase().includes(query)) continue;
        lines.push(rel);
        if (lines.length >= 2e3) break;
      }
    }
    return toolText(
      id,
      lines.length === 0 ? "No matching .cmir/.docx files found." : lines.join("\n") + (lines.length >= 2e3 ? "\n\u2026 (truncated at 2000 entries \u2014 use query)" : "")
    );
  }
  if (name === "read_debate_file") {
    const p = args["path"];
    if (typeof p !== "string" || !p) return toolText(id, "read_debate_file: `path` is required.", true);
    let rel = p;
    if (roots.length > 1 && !p.startsWith("/")) {
      const first = p.split(import_node_path2.sep)[0];
      const match = roots.find((r) => (0, import_node_path2.basename)(r) === first);
      if (match) rel = (0, import_node_path2.join)(match, p.slice(first.length + 1));
    }
    const real = resolveWithinRoots(roots, rel);
    if (!real) return toolText(id, `read_debate_file: "${p}" not found inside the configured folders.`, true);
    const ext = (0, import_node_path2.extname)(real).toLowerCase();
    if (!CONVERTIBLE2.has(ext)) return toolText(id, `read_debate_file: "${p}" is not a .cmir or .docx file.`, true);
    const kind = ext === ".docx" ? "docx" : "cmir";
    const form = args["form"] === "json" ? "json" : "text";
    const bytes = new Uint8Array((0, import_node_fs2.readFileSync)(real));
    try {
      if (form === "json") {
        const json = await toUncompressedJson(bytes, kind);
        if (json.length > JSON_CAP) {
          return toolText(
            id,
            `read_debate_file: the JSON form of "${p}" is ${(json.length / 1e6).toFixed(1)} MB \u2014 too large to return. Use form:"text".`,
            true
          );
        }
        return toolText(id, json);
      }
      const doc = await parseToDoc(bytes, kind);
      let text = renderPlainText(doc, (0, import_node_path2.basename)(real));
      if (text.length > TEXT_CAP) {
        text = text.slice(0, TEXT_CAP) + `

[\u2026truncated: rendering is ${text.length.toLocaleString()} chars; showing the first ${TEXT_CAP.toLocaleString()}]`;
      }
      return toolText(id, text);
    } catch (e) {
      return toolText(id, `read_debate_file: couldn't convert "${p}": ${e instanceof Error ? e.message : e}`, true);
    }
  }
  return err2(id, -32602, `unknown tool "${name}"`);
}
async function handleMcpMessage(roots, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return err2(null, -32700, "parse error");
  }
  const id = msg.id ?? null;
  const isNotification = msg.id === void 0;
  switch (msg.method) {
    case "initialize":
      return ok(id, {
        protocolVersion: typeof msg.params?.["protocolVersion"] === "string" ? msg.params["protocolVersion"] : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO
      });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call": {
      const name = msg.params?.["name"];
      const args = msg.params?.["arguments"] ?? {};
      if (typeof name !== "string") return err2(id, -32602, "tools/call needs params.name");
      return callTool(roots, id, name, args);
    }
    default:
      if (isNotification) return null;
      return err2(id, -32601, `method not found: ${msg.method}`);
  }
}
function runMcpHttpServer(roots, port) {
  const resolved = roots.map((r) => (0, import_node_path2.resolve)(r));
  const server = (0, import_node_http.createServer)((req, res) => {
    const origin = req.headers.origin;
    if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" });
      res.end();
      return;
    }
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (c) => {
      body += c;
      if (body.length > 1e7) req.destroy();
    });
    req.on("end", () => {
      void handleMcpMessage(resolved, body).then((reply) => {
        if (reply === null) {
          res.writeHead(202);
          res.end();
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(reply);
        }
      });
    });
  });
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(
      `cardmirror-read MCP server listening on http://127.0.0.1:${port}/mcp
(serving ${resolved.length} folder(s): ${resolved.join(", ")})
Paste that URL into your assistant's custom MCP server field. Keep this running.
`
    );
  });
}
function runMcpServer(roots) {
  const resolved = roots.map((r) => (0, import_node_path2.resolve)(r));
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      void handleMcpMessage(resolved, line).then((reply) => {
        if (reply !== null) process.stdout.write(reply + "\n");
      });
    }
  });
  process.stdin.on("end", () => process.exit(0));
}

// src/tools/cardmirror-read-cli.ts
process.stdout.on("error", (err3) => {
  if (err3.code === "EPIPE") process.exit(0);
  throw err3;
});
function fail(msg) {
  process.stderr.write(`cardmirror-read: ${msg}
`);
  process.exit(1);
}
function usage() {
  process.stderr.write(
    "Usage:\n  cardmirror-read <file.cmir|file.docx> [--form text|json] [--stdout] [--out PATH]\n  cardmirror-read --mirror DIR [--mirror DIR \u2026] --out-dir DIR\n  cardmirror-read --mcp --root DIR [--root DIR \u2026]\n  cardmirror-read --mcp-http [--port N] --root DIR [--root DIR \u2026]\n"
  );
  process.exit(1);
}
async function main() {
  const args = process.argv.slice(2);
  let file = null;
  let form = "text";
  let stdout = false;
  let outPath = null;
  const mirrors = [];
  let outDir = null;
  let mcp = false;
  let mcpHttp = false;
  let port = 3323;
  const roots = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--mirror") {
      const v = args[++i];
      if (!v) fail("--mirror needs a folder");
      mirrors.push(v);
    } else if (a === "--out-dir") {
      outDir = args[++i] ?? null;
      if (!outDir) fail("--out-dir needs a folder");
    } else if (a === "--mcp") mcp = true;
    else if (a === "--mcp-http") mcpHttp = true;
    else if (a === "--port") {
      const v = Number(args[++i]);
      if (!Number.isInteger(v) || v < 1 || v > 65535) fail("--port needs a port number");
      port = v;
    } else if (a === "--root") {
      const v = args[++i];
      if (!v) fail("--root needs a folder");
      roots.push(v);
    } else if (a === "--form") {
      const v = args[++i];
      if (v !== "text" && v !== "json") fail(`--form must be "text" or "json", got "${v}"`);
      form = v;
    } else if (a === "--stdout") stdout = true;
    else if (a === "--out") {
      outPath = args[++i] ?? null;
      if (!outPath) fail("--out needs a path");
    } else if (a === "--help" || a === "-h") usage();
    else if (a.startsWith("--")) fail(`unknown flag ${a}`);
    else if (file) fail("only one input file is supported");
    else file = a;
  }
  if (mcp || mcpHttp) {
    if (mirrors.length || file) fail("--mcp cannot be combined with --mirror or a file argument");
    if (roots.length === 0) fail("--mcp needs at least one --root folder to serve");
    if (mcpHttp) runMcpHttpServer(roots, port);
    else runMcpServer(roots);
    return;
  }
  if (mirrors.length > 0) {
    if (file) fail("--mirror cannot be combined with a file argument");
    if (!outDir) fail("--mirror needs --out-dir");
    await runMirror(mirrors, outDir);
    return;
  }
  if (!file) usage();
  let bytes;
  try {
    bytes = new Uint8Array((0, import_node_fs3.readFileSync)((0, import_node_path3.resolve)(file)));
  } catch (err3) {
    fail(`can't read "${file}": ${err3 instanceof Error ? err3.message : err3}`);
  }
  const ext = (0, import_node_path3.extname)(file).toLowerCase();
  const kind = ext === ".docx" ? "docx" : ext === ".cmir" || looksLikeNative(bytes) ? "cmir" : fail(
    `unsupported file type "${ext || "(none)"}" \u2014 expected .cmir or .docx`
  );
  let content;
  try {
    if (form === "json") {
      content = await toUncompressedJson(bytes, kind);
    } else {
      const doc = await parseToDoc(bytes, kind);
      content = renderPlainText(doc, (0, import_node_path3.basename)(file));
    }
  } catch (err3) {
    if (err3 instanceof NativeDamagedError) {
      fail(
        `this .cmir is damaged beyond the automatic repairs (${err3.message}); try --form json for the raw (uncompressed) envelope`
      );
    }
    fail(`couldn't convert "${file}": ${err3 instanceof Error ? err3.message : err3}`);
  }
  if (stdout) {
    process.stdout.write(content);
    return;
  }
  const target = outPath ?? (0, import_node_path3.join)(
    (0, import_node_fs3.mkdtempSync)((0, import_node_path3.join)((0, import_node_os.tmpdir)(), "cardmirror-read-")),
    `${(0, import_node_path3.basename)(file, (0, import_node_path3.extname)(file))}.${form === "json" ? "json" : "txt"}`
  );
  (0, import_node_fs3.writeFileSync)(target, content);
  (0, import_node_fs3.chmodSync)(target, 292);
  process.stdout.write((0, import_node_path3.resolve)(target) + "\n");
}
void main();
