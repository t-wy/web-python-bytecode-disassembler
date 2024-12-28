function _clone(x) {
    if (Array.isArray(x)) {
        let y = [];
        for (let item of x) {
            y.push(_clone(item));
        }
        return y;
    } else if (x instanceof Uint8Array.__proto__) { // TypedArray
        return x.slice();
    } else if (typeof x === "object") {
        let y = {};
        for (let key in x) {
            y[key] = _clone(x[key]);
        }
        return y;
    } else {
        return x;
    }
}

function real_repr(object) {
    return object.real_repr ?? object.repr;
}

None = {"type": "NoneType", "repr": "None"}

function marshal_loads(reader, version) {
    // Python/marshal.c, converted by t-wy
    var refs = [];
    var strings = []; // python 2
    function parse() {
        function parse_object(type) {
            switch (type) {
                case 0x30: // 0 - TYPE_NULL
                {
                    // return type: /
                    return {"type": "NULL", "repr": "NULL"};
                }
                case 0x4e: // N - TYPE_NONE
                {
                    // return type: NoneType
                    return None;
                }
                case 0x46: // F - TYPE_FALSE
                {
                    // return type: bool
                    return {"type": "bool", "repr": "False"};
                }
                case 0x54: // T - TYPE_TRUE
                {
                    // return type: bool
                    return {"type": "bool", "repr": "True"};
                }
                case 0x53: // S - TYPE_STOPITER
                {
                    // return type: ellipsis
                    return {"type": "ellipsis", "repr": "Ellipsis", "real_repr": "..."};
                }
                case 0x2e: // . - TYPE_ELLIPSIS
                {
                    // return type: ellipsis
                    return {"type": "StopIteration", "repr": "StopIteration()"};
                }
                case 0x69: // i - TYPE_INT
                {
                    // return type: int
                    let temp = reader.readInt();
                    return {"type": "int", "repr": temp.toString(), "value": temp, "number": Number(temp)};
                }
                case 0x49: // I - TYPE_INT64
                {
                    // return type: int
                    let lo = reader.readInt();
                    let hi = reader.readInt();
                    let temp = (hi << 32) | lo;
                    return {"type": "int", "repr": temp.toString(), "value": temp, "number": Number(temp)};
                }
                case 0x67: // g - TYPE_BINARY_FLOAT
                {
                    // return type: float
                    // little-endian
                    let temp = [];
                    for (let i = 0; i < 8; ++i) {
                        temp.push(reader.readByte());
                    }
                    let result = new Float64Array(new Uint8Array(temp).buffer)[0];
                    if (Number.isInteger(result)) {
                        return {"type": "float", "repr": `${result}.0`};
                    } else {
                        return {"type": "float", "repr": `${result}`};
                    }
                }
                case 0x79: // y - TYPE_BINARY_COMPLEX
                {
                    // return type: complex
                    // little-endian
                    let temp = [];
                    for (let i = 0; i < 16; ++i) {
                        temp.push(reader.readByte());
                    }
                    let result = new Float64Array(new Uint8Array(temp).buffer);
                    let plus_sign = (Object.is(result[1], +0) || result[1] > 0) ? "+" : "";
                    let repr_value;
                    let real_repr_value, priority;
                    if (Object.is(result[0], +0)) {
                        repr_value = `${result[1]}j`;
                        if (Object.is(result[1], +0) || result[1] > 0) {
                            real_repr_value = `${result[1]}j`;
                            priority = 0;
                        } else if (Object.is(result[1], -0)) {
                            // +0 - 0j
                            real_repr_value = `-(-0.0*1j)`;
                            priority = 5;
                        } else {
                            real_repr_value = `0${result[1]}j`;
                            priority = 7;
                        }
                    } else if (Object.is(result[0], -0)) {
                        repr_value = `(-0${plus_sign}${result[1]}j)`;
                        if (Object.is(result[1], +0)) {
                            // -0 + +0j
                            real_repr_value = `-0.0*1j`;
                            priority = 6;
                        } else if (Object.is(result[1], -0)) {
                            // -0 + -0j
                            real_repr_value = `-0j`;
                            priority = 5;
                        } else if (result[1] > 0) {
                            real_repr_value = `-(0-${result[1]}j)`;
                            priority = 5;
                        } else {
                            real_repr_value = `${result[1]}j`;
                            priority = 5;
                        }
                    } else {
                        repr_value = `(${result[0]}${plus_sign}${result[1]}j)`;
                        if (Object.is(result[1], -0)) {
                            // -0 + -0j
                            real_repr_value = `-(${result[0]}+0j)`;
                            priority = 5;
                        } else {
                            real_repr_value = `${result[0]}${plus_sign}${result[1]}j`;
                            priority = 7;
                        }
                    }
                    return {
                        "type": "complex",
                        "repr": repr_value,
                        "real_repr": real_repr_value,
                        "priority": priority
                    };
                }
                case 0x6c: // l - TYPE_LONG
                {
                    // return type: int
                    let len = reader.readInt();
                    let sign = len >= 0;
                    if (!sign) sign = -sign;
                    let temp = 0n;
                    for (let i = 0n; i < len; ++i) {
                        temp |= BigInt(reader.readShort()) << (i * 15n);
                    }
                    temp = sign ? temp : -temp;
                    return {"type": "int", "repr": temp.toString(), "value": temp, "number": Number(temp)};
                }
                case 0x73: // s - TYPE_STRING
                {
                    if (array_compare(version, [3]) >= 0) { // python 3.0+
                        // return type: bytes
                        let bytes = reader.readBytes(reader.readInt());
                        let str = Array.from(bytes).map(byte2str).join("");
                        if (str.includes("'") && !str.includes('"')) {
                            return {"type": "bytes", "repr": `b"${str}"`, "value": bytes};
                        } else {
                            return {"type": "bytes", "repr": `b'${str.replaceAll("'", "\'").replaceAll('\"', '"')}'`, "value": bytes};
                        }
                    };
                    // otherwise, don't break and parse strings instead
                }
                case 0x74: // t - TYPE_INTERNED
                case 0x75: // u - TYPE_UNICODE
                case 0x61: // a - TYPE_ASCII
                case 0x41: // A - TYPE_ASCII_INTERNED
                {
                    // return type: str
                    let bytes = reader.readBytes(reader.readInt());
                    let actualstr = String.fromCharCode(...bytes);
                    let str = utf8string(Array.from(bytes));
                    if (str.includes("'") && !str.includes('"')) {
                        temp = {"type": "str", "repr": `"${str}"`, "str": actualstr, "value": bytes};
                    } else {
                        temp = {"type": "str", "repr": `'${str.replaceAll("'", "\'").replaceAll('\"', '"')}'`, "str": actualstr, "value": bytes};
                    }
                    if (type === 0x74) { // python 2 Stringref
                        // TYPE_INTERNED
                        strings.push(temp);
                    }
                    return temp;
                }
                case 0x52: // R - TYPE_STRINGREF
                    let index = reader.readInt();
                    return _clone(strings[index]);
                case 0x72: // r - TYPE_REF
                {
                    // return type: ?
                    let index = reader.readInt();
                    return _clone(refs[index]);
                }
                case 0x28: // ( - TYPE_TUPLE
                {
                    // return type: tuple
                    let len = reader.readInt();
                    let temp = [];
                    for (let i = 0; i < len; ++i) {
                        temp.push(parse());
                    }
                    return {
                        "type": "tuple",
                        "children": temp,
                        "repr": `(${temp.map(t => t.repr).join(", ")}${temp.length === 1 ? ",": ""})`,
                        "real_repr": `(${temp.map(t => real_repr(t)).join(", ")}${temp.length === 1 ? ",": ""})`
                    };
                }
                case 0x5b: // [ - TYPE_LIST
                {
                    // return type: list
                    let len = reader.readInt();
                    let temp = [];
                    for (let i = 0; i < len; ++i) {
                        temp.push(parse());
                    }
                    return {
                        "type": "list",
                        "children": temp,
                        "repr": `[${temp.map(t => t.repr).join(", ")}]`,
                        "real_repr": `[${temp.map(t => real_repr(t)).join(", ")}]`,
                    };
                }
                case 0x7b: // { - TYPE_DICT
                {
                    // return type: dict
                    let len = reader.readInt();
                    let temp = [];
                    let temp_real = [];
                    let keys = [];
                    let values = [];
                    let key, value;
                    for (let i = 0; i < len; ++i) {
                        key = parse();
                        if (key.type === "NULL") {
                            break;
                        }
                        value = parse();
                        if (value.type === "NULL") {
                            break;
                        }
                        keys.push(key);
                        values.push(value);
                        temp.push(`${key.repr}: ${value.repr}`);
                        temp_real.push(`${repr(key)}: ${repr(value)}`);
                    }
                    return {
                        "type": "dict",
                        "keys": keys,
                        "values": values,
                        "repr": `{${temp.join(", ")}}`,
                        "real_repr": `{${temp_real.join(", ")}}`
                    };
                }
                case 0x63: // c - TYPE_CODE
                {
                    let children = [];
                    let argcount = reader.readInt();
                    let posonlyargcount = -1;
                    if (array_compare(version, [3, 8]) >= 0) {
                        posonlyargcount = reader.readInt();
                    }
                    let kwonlyargcount = -1;
                    if (array_compare(version, [3]) >= 0) {
                        kwonlyargcount = reader.readInt();
                    }
                    let nlocals = 0;
                    if (array_compare(version, [3, 11]) < 0) {
                        nlocals = reader.readInt();
                    }
                    let stacksize = reader.readInt();
                    let flags = reader.readInt();
                    let code = parse();
                    let consts = parse();
                    if (consts.children.repr !== "None") {
                        consts.children.forEach(c => {
                            if ((c.type ?? "") === "code") {
                                children.push(c);
                            }
                        })
                    }
                    let names = parse();
                    let dummy = {type: 'tuple', children: Array(0), repr: '()'};
                    let varnames = _clone(dummy);
                    let freevars = _clone(dummy);
                    let cellvars = _clone(dummy);
                    let localsplusnames = _clone(dummy);
                    let localspluskinds = _clone(dummy);
                    let nlocalsplus = 0;
                    let ncellvars = 0;
                    let nplaincellvars = 0;
                    let nfreevars = 0;
                    if (array_compare(version, [3, 11]) < 0) {
                        varnames = parse();
                        freevars = parse();
                        cellvars = parse();
                    } else {
                        localsplusnames = parse();
                        localspluskinds = parse();
                        nlocalsplus = localsplusnames.children.length;
                        for (let i = 0; i < nlocalsplus; ++i) {
                            let kind = localspluskinds.value[i];
                            if (kind & 0x20) { // CO_FAST_LOCAL
                                ++nlocals;
                                varnames.children.push(localsplusnames.children[i]);
                                if (kind & 0x40) { // CO_FAST_CELL
                                    ++ncellvars;
                                    cellvars.children.push(localsplusnames.children[i]);
                                }
                            } else if (kind & 0x40) { // CO_FAST_CELL
                                ++ncellvars;
                                cellvars.children.push(localsplusnames.children[i]);
                                ++nplaincellvars;
                            } else if (kind & 0x80) { // CO_FAST_FREE
                                ++nfreevars;
                                freevars.children.push(localsplusnames.children[i]);
                            }
                        }
                    }
                    let filename = parse();
                    let name = parse();
                    let qualname = null;
                    if (array_compare(version, [3, 11]) >= 0) {
                        qualname = parse();
                    }
                    let firstlineno = reader.readInt();
                    let lnotab = null; // line(number)table
                    let linetable = null;
                    if (array_compare(version, [3, 10]) >= 0) {
                        linetable = parse();
                    } else {
                        lnotab = parse();
                    }
                    let exceptiontable = null;
                    if (array_compare(version, [3, 11]) >= 0) {
                        exceptiontable = parse();
                    }
                    let label = `<code object ${name.str} at 0x----------------, file "${filename.str}", line ${firstlineno}>`;
                    return {"type": "code", "dict": {
                        "version": version,
                        "argcount": argcount,
                        "posonlyargcount": posonlyargcount,
                        "kwonlyargcount": kwonlyargcount,
                        "nlocals": nlocals,
                        "stacksize": stacksize,
                        "flags": flags,
                        "code": code,
                        "consts": consts,
                        "names": names,
                        "varnames": varnames,
                        "freevars": freevars,
                        "cellvars": cellvars,
                        "localsplusnames": localsplusnames,
                        "localspluskinds": localspluskinds,
                        "filename": filename,
                        "name": name,
                        "qualname": qualname,
                        "firstlineno": firstlineno,
                        "lnotab": lnotab,
                        "linetable": linetable,
                        "exceptiontable": exceptiontable,
                    }, "children": children, "repr": label, "label": label};
                }
                case 0x75: // u - TYPE_UNICODE
                {
                    // covered in t - TYPE_INTERNED
                    return null;
                }
                case 0x3c: // < - TYPE_SET
                case 0x3e: // > - TYPE_FROZENSET
                {
                    let len = reader.readInt();
                    let temp = [];
                    for (let i = 0; i < len; ++i) {
                        temp.push(parse());
                    }
                    if (len > 0) {
                        return {
                            "type": "frozenset",
                            "children": temp,
                            "repr": `frozenset({${temp.map(t => t.repr).join(", ")}})`,
                            "real_repr": `frozenset({${temp.map(t => real_repr(t)).join(", ")}})`
                        };
                    } else {
                        return {
                            "type": "frozenset",
                            "children": temp,
                            "repr": `frozenset()`
                        };
                    }
                }
                case 0x29: // ) - TYPE_SMALL_TUPLE
                {
                    // return type: tuple
                    let len = reader.readByte();
                    let temp = [];
                    for (let i = 0; i < len; ++i) {
                        temp.push(parse());
                    }
                    return {
                        "type": "tuple",
                        "children": temp,
                        "repr": `(${temp.map(t => t.repr).join(", ")}${temp.length === 1 ? ",": ""})`,
                        "real_repr": `(${temp.map(t => real_repr(t)).join(", ")}${temp.length === 1 ? ",": ""})`
                    };
                }
                case 0x61: // a - TYPE_ASCII
                case 0x41: // A - TYPE_ASCII_INTERNED
                {
                    // covered in t - TYPE_INTERNED
                    return null;
                }
                case 0x7a: // z - TYPE_SHORT_ASCII
                case 0x5a: // Z - TYPE_SHORT_ASCII_INTERNED
                {
                    // return type: str
                    let bytes = reader.readBytes(reader.readByte());
                    let actualstr = String.fromCharCode(...bytes);
                    let str = Array.from(bytes).map(str2str).join("");
                    if (str.includes("'") && !str.includes('"')) {
                        return {"type": "str", "repr": `"${str}"`, "str": actualstr, "value": bytes};
                    } else {
                        return {"type": "str", "repr": `'${str.replaceAll("'", "\'").replaceAll('\"', '"')}'`, "str": actualstr, "value": bytes};
                    }
                }
                default:
                {
                    let text = `UNKNOWN TYPE: ${String.fromCharCode(type)} (${type} (0x${type.toString(16).padStart(2, "0")})) at position ${reader.tell()}`;
                    alert(text);
                    return {"repr": text};
                }
            }
        }
        var raw = reader.readByte();
        var type = raw & 0x7f;
        // console.debug(`Position: ${reader.tell()}, Type: ${type}`);
        var result;
        if (raw & 0x80) { // FLAG_REF
            var index = refs.length;
            refs.push(null);
            result = parse_object(type);
            refs[index] = _clone(result);
        } else {
            result = parse_object(type);
        }
        return result;
    };
    return parse();
}

// this file is created by t-wy

function deflate_decompress(arr) {
    const cs = new DecompressionStream('deflate');
    const writer = cs.writable.getWriter();
    writer.write(new Uint8Array(Uint8Array.from(atob(arr), x => x.charCodeAt(0))).buffer);
    writer.close();
    return new Response(cs.readable).arrayBuffer().then(function (arrayBuffer) {
        return new TextDecoder().decode(arrayBuffer);
    });
}

deflate_decompress("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").then(deflate_decompress).then(result => printable = result);

function byte2str(code) {
    let special = {9: "t", 10: "n", 13: "r"};
    if (code >= 0x7f) {
        return `\\x${code.toString(16).padStart(2, "0")}`;
    } else if (code == 92) {
        return "\\";
    } else if (code >= 0x20) {
        return String.fromCharCode(code);
    } else if (special[code] !== undefined) {
        return `\\${special[code]}`;
    } else {
        return `\\x${code.toString(16).padStart(2, "0")}`;
    }
}

function str2str(code) {
    function escape(code) {
        if (code <= 0xff) {
            return `\\x${code.toString(16).padStart(2, "0")}`;
        } else if (code <= 0xff) {
            return `\\u${code.toString(16).padStart(4, "0")}`;
        } else {
            return `\\U${code.toString(16).padStart(8, "0")}`;
        }
    }
    let special = {9: "t", 10: "n", 13: "r"};
    if (special[code] !== undefined) {
        return `\\${special[code]}`;
    } else if (code == 0x7f || code < 0x20) {
        return escape(code);
    } else if (code == 92) {
        return "\\";
    } else if (code >= 0x110000) {
        return escape(code);
    } else if (printable[code] === "1") {
        return String.fromCodePoint(code);
    } else {
        return escape(code);
    }
}

function utf8string(codes) {
    var result = [];
    var cursor = 0;
    while (cursor < codes.length) {
        if (codes[cursor] < 0x80) {
            result.push(str2str(codes[cursor]));
            cursor++;
        } else if ((codes[cursor] & 0xe0) == 0xc0 && cursor + 1 < codes.length) {
            if (codes[cursor + 1] & 0xe0) {
                result.push(str2str((codes[cursor] & 0x1f) << 6 | (codes[cursor + 1] & 0x3f)));
                cursor += 2;
            } else {
                return "<Invalid UTF-8 sequence>";
            }
        } else if ((codes[cursor] & 0xf0) == 0xe0 && cursor + 2 < codes.length) {
            if (codes[cursor + 1] & 0xc0 && codes[cursor + 2] & 0xc0) {
                result.push(str2str((codes[cursor] & 0x0f) << 12 | (codes[cursor + 1] & 0x3f) << 6 | (codes[cursor + 2] & 0x3f)));
                cursor += 3;
            } else {
                return "<Invalid UTF-8 sequence>";
            }
        } else if ((codes[cursor] & 0xf8) == 0xf0 && cursor + 3 < codes.length) {
            if (codes[cursor + 1] & 0xc0 && codes[cursor + 2] & 0xc0 && codes[cursor + 3] & 0xc0) {
                result.push(str2str((codes[cursor] & 0x07) << 18 | (codes[cursor + 1] & 0x3f) << 12 | (codes[cursor + 2] & 0x3f) << 6 | (codes[cursor + 3] & 0x3f)));
                cursor += 4;
            } else {
                return "<Invalid UTF-8 sequence>";
            }
        } else {
            return "<Invalid UTF-8 sequence>";
        }
    }
    return result.join("");
}