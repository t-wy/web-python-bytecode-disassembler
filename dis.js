// this file is created by t-wy

// this repr is for generating code
function real_repr(object) {
    return object.real_repr ?? object.repr;
}

function subscr_repr(object) {
    // handle the [x] syntax
    // e.g [1], ["key"], [1:2:3], [1:,:2,(3,4)]
    var to_process = [];
    if (object.type === "tuple") {
        to_process = object.children;
    } else {
        to_process.push(object);
    }
    var reprs = [];
    for (var i = 0; i < to_process.length; ++i) {
        var entry = to_process[i];
        if (entry.type === "slice") {
            let start_repr = entry.start === None ? "" : real_repr(entry.start);
            let stop_repr = entry.stop === None ? "" : real_repr(entry.stop);
            let step_repr = entry.step === None ? "" : (":" + real_repr(entry.step));
            reprs.push(`${start_repr}:${stop_repr}${step_repr}`);
        } else {
            reprs.push(real_repr(entry));
        }
    }
    return `${reprs.join(", ")}`;
}

function get_priority(object) {
    return object.priority ?? 0;
}

// Lib/dis.py
var show_caches = false;

function dis(code_dict) {
    var {version, argcount, posonlyargcount, kwonlyargcount, nlocals, stacksize, flags, code, consts, names, varnames, freevars, cellvars, localsplusnames, localspluskinds, filename, name, qualname, firstlineno, lnotab, linetable, exceptiontable} = code_dict;
    let lines = [];

    let compiler_flag_names = {1: "OPTIMIZED", 2: "NEWLOCALS", 4: "VARARGS", 8: "VARKEYWORDS", 16: "NESTED", 32: "GENERATOR", 64: "NOFREE", 128: "COROUTINE", 256: "ITERABLE_COROUTINE", 512: "ASYNC_GENERATOR"};
    let flag_names = [];
    lines.push(" Show Code");
    lines.push("------------------------------");
    let remaining_flag = flags;
    for (let i = 0; i < 32; ++i) {
        let flag = 1 << i;
        if (remaining_flag & flag) {
            let flag_name = compiler_flag_names[flag];
            flag_names.push(flag_name === undefined ? flag.toString(16) : flag_name);
            remaining_flag ^= flag
            if (remaining_flag === 0) break;
        }
    }
    if (remaining_flag) {
        flag_names.push(remaining_flag.toString(16));
    }
    if (flag_names.length === 0) {
        flag_names.push("0x0");
    }
    lines.push("Name:              " + name.str);
    if (array_compare(version, [3]) >= 0) { // str
        lines.push("Filename:          " + filename.str);
    } else { // bytes
        lines.push("Filename:          " + filename.str);
    }
    lines.push("Argument count:    " + argcount);
    if (array_compare(version, [3, 8]) >= 0) {
        lines.push("Positional-only arguments: " + posonlyargcount);
    };
    if (array_compare(version, [3]) >= 0) {
        lines.push("Kw-only arguments: " + kwonlyargcount);
    };
    lines.push("Number of locals:  " + nlocals);
    lines.push("Stack size:        " + stacksize);
    lines.push("Flags:             " + flag_names.join(", "));
    if (consts.children.length) {
        lines.push("Constants:");
        consts.children.forEach((item, index) => {
            lines.push(`${index.toString().padStart(4)}: ${item.repr}`);
        })
    }
    if (names.children.length) {
        lines.push("Names:");
        names.children.forEach((item, index) => {
            lines.push(`${index.toString().padStart(4)}: ${item.str}`);
        })
    }
    if (varnames.children.length) {
        lines.push("Variable names:");
        varnames.children.forEach((item, index) => {
            lines.push(`${index.toString().padStart(4)}: ${item.str}`);
        })
    }
    if (freevars.children.length) {
        lines.push("Free variables:");
        freevars.children.forEach((item, index) => {
            lines.push(`${index.toString().padStart(4)}: ${item.str}`);
        })
    }
    if (cellvars.children.length) {
        lines.push("Cell variables:");
        cellvars.children.forEach((item, index) => {
            lines.push(`${index.toString().padStart(4)}: ${item.str}`);
        })
    }
    lines.push("==============================");
    lines.push(" Disassembly");
    lines.push("------------------------------");
    var unsupported_opcodes = new Set();
    var source_code = [];
    var scope_entries = [
        /*
        Format: {"type":, "start":, "end": , "istart": , "iend": , }
        start / end: facilitates jumps
        istart / iend: facilitates indentation
        */
    ];
    if (array_compare(version, [2, 6]) >= 0 && array_compare(version, [3, 13]) <= 0) { // opargs
        let opargs = [];
        let version_str = version.join(".");
        let opcode_list = opcodes[version_str] ?? null;
        let inline_cache_entries = _inline_cache_entries[version_str] ?? null;
        if (opcode_list === null) {
            lines.push("Currently Not Supported");
        }
        // _unpack_opargs
        if (opcode_list !== null) {
            let extended_arg = 0;
            let arg;
            if (array_compare(version, [3, 6]) >= 0) {
                for (let i = 0; i < code.value.length; i += 2) {
                    let op = code.value[i];
                    if (op >= opcode_list["HAVE_ARGUMENT"]) {
                        arg = code.value[i + 1] | extended_arg;
                        extended_arg = op === opcode_list["EXTENDED_ARG"] ? arg << 8 : 0;
                    } else {
                        arg = null;
                        if (array_compare(version, [3, 10]) >= 0) {
                            extended_arg = 0;
                        }
                    }
                    opargs.push({"offset": i, "opcode": op, "arg": arg});
                }
            } else {
                for (let i = 0; i < code.value.length;) {
                    let offset = i;
                    let op = code.value[i];
                    ++i;
                    if (op >= opcode_list["HAVE_ARGUMENT"]) {
                        arg = code.value[i] + code.value[i + 1] * 256 + extended_arg;
                        extended_arg = 0;
                        i += 2;
                        if (op === opcode_list["EXTENDED_ARG"]) {
                            extended_arg = arg << 16;
                        }
                    }
                    opargs.push({"offset": offset, "opcode": op, "arg": arg});
                }
            }
        }
        // lines.push(JSON.stringify(opargs));
        
        // findlinestarts
        let linestarts = {};
        if (array_compare(version, [3, 11]) >= 0) {
            // co_lines from codeobject.c
            let lastlineno = null;
            let lineno = firstlineno;
            let addr = 0;
            let byte_incr = null;
            let line_incr = null;
            let shift = -1;
            let varint = 0;
            // lineiter_next
            var cursor = 0;
            while (cursor < linetable.value.length) {
                var incr = linetable.value[cursor];
                line_incr = {
                    15: 0, // PY_CODE_LOCATION_INFO_NONE
                    13: 3, // PY_CODE_LOCATION_INFO_NO_COLUMNS,
                    14: 3, // PY_CODE_LOCATION_INFO_LONG
                    10: 0, // PY_CODE_LOCATION_INFO_ONE_LINE0
                    11: 1, // PY_CODE_LOCATION_INFO_ONE_LINE1
                    12: 2, // PY_CODE_LOCATION_INFO_ONE_LINE2
                }[(incr >> 3) & 15] ?? 0; // Same line
                if (line_incr === 3) {
                    var cursor2 = cursor + 1;
                    shift = 0; // scan_signed_varint
                    var read = linetable.value[cursor2++];
                    line_incr = read & 63;
                    while (read & 64) {
                        read = linetable.value[cursor2++];
                        shift += 6;
                        line_incr |= (read & 63) << shift;
                    };
                    if (line_incr & 1) {
                        line_incr = -(line_incr >> 1);
                    } else {
                        line_incr = line_incr >> 1;
                    }
                }
                lineno += line_incr;
                // is_no_line_marker: (incr >> 3) === 0x1f
                if (!((incr >> 3) === 0x1f)) {
                    if (lineno !== lastlineno) {
                        linestarts[addr] = lineno;
                        lastlineno = lineno;
                    }
                }
                // next_code_delta
                addr += ((incr & 7) + 1) * 2; // sizeof(CODEUNIT);
                ++cursor;
                while (cursor < linetable.value.length && (linetable.value[cursor] & 128) === 0) {
                    ++cursor;
                }
            }
            // console.log(linestarts);
        } else if (array_compare(version, [3, 10]) >= 0) {
            // co_lines from codeobject.c
            let lastlineno = null;
            let lineno = firstlineno;
            let addr = 0;
            let loc = false; // delta, ldelta
            let byte_incr = null;
            // lineiter_next
            linetable.value.forEach(line_incr => {
                loc = !loc;
                if (loc) {
                    byte_incr = line_incr;
                } else {
                    // line_incr
                    if (line_incr !== 0x80) {
                        lineno += line_incr - (line_incr >= 0x80 ? 0x100 : 0);
                        if (byte_incr) {
                            if (lastlineno !== lineno) {
                                linestarts[addr] = lineno;
                                lastlineno = lineno;
                            }
                        }
                    }
                    addr += byte_incr;
                }
            })
            // console.log(linestarts);
        } else {
            let lastlineno = null;
            let lineno = firstlineno;
            let addr = 0;
            let loc = false; // byte_incr, line_incr
            let byte_incr = null;
            lnotab.value.forEach(line_incr => {
                loc = !loc;
                if (loc) {
                    byte_incr = line_incr;
                } else {
                    // byte_incr
                    if (byte_incr) {
                        if (lineno !== lastlineno) {
                            linestarts[addr] = lineno;
                            lastlineno = lineno;
                        }
                    }
                    addr += byte_incr;
                    // line_incr
                    if (array_compare(version, [3, 6]) >= 0) {
                        lineno += line_incr - (line_incr >= 0x80 ? 0x100 : 0);
                    } else {
                        lineno += line_incr;
                    }
                }
            })
            if (lineno !== lastlineno) {
                linestarts[addr] = lineno;
            }
            // console.log(linestarts);
        }
        // lines.push(JSON.stringify(linestarts));
        

        // findlabels
        var directed_graph = [];
        var graph_wait = [0];
        let labels = new Set();
        let label;
        var last_offset = null;
        var connected = true;
        opargs.forEach(item => {
            if (connected && last_offset !== null) {
                directed_graph.push([last_offset, item.offset]);
            }
            connected = true;
            last_offset = item.offset;
            let opcode = opcode_list["opmap"][item.opcode] ?? `<${item.opcode}>`;
            if (item.arg !== null) {
                if (opcode_list["hasjrel"].includes(item.opcode)) {
                    // relative jump
                    var signed_arg = item.arg;
                    if (array_compare(version, [3, 10]) >= 0) {
                        if (array_compare(version, [3, 11]) >= 0) {
                            if (opcode.indexOf("JUMP_BACKWARD") === 0) {
                                signed_arg = -signed_arg;
                            }
                        }
                        label = item.offset + 2 + signed_arg * 2;
                        if (array_compare(version, [3, 12]) >= 0) {
                            label += 2 * (inline_cache_entries[opcode] ?? 0);
                        }
                    } else if (array_compare(version, [3, 6]) >= 0) {
                        label = item.offset + 2 + signed_arg;
                    } else  {
                        label = item.offset + 3 + signed_arg;
                    }
                } else if (opcode_list["hasjabs"].includes(item.opcode)) {
                    // absolute jump
                    if (array_compare(version, [3, 10]) >= 0) {
                        label = item.arg * 2;
                    } else {
                        label = item.arg;
                    }
                } else {
                    return;
                }
                // set can handle duplicates
                labels.add(label);
                directed_graph.push([item.offset, label]);
                if (opcode.indexOf("IF") === -1) { // unconditional jumps
                    connected = false;
                }
            }
        })
        directed_graph.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
        console.log("digraph{\n" + directed_graph.map(x => `"${x[0]}"->"${x[1]}"`).join("\n") + "\n}");
        // lines.push(JSON.stringify(labels));

        // _parse_exception_table
        var exception_entries = [];
        if (exceptiontable !== null) {
            var cursor = 0;
            function _parse_varint() {
                var b = exceptiontable.value[cursor++];
                var val = b & 63;
                while (b & 64) {
                    val <<= 6;
                    b = exceptiontable.value[cursor++];
                    val |= b & 63;
                }
                return val;
            }
            while (cursor < exceptiontable.value.length) {
                var start = _parse_varint() * 2;
                var length = _parse_varint() * 2;
                var end = start + length;
                var target = _parse_varint() * 2;
                var dl = _parse_varint();
                var depth = dl >> 1;
                var lasti = (dl & 1) === 1;
                exception_entries.push({
                    "start": start,
                    "end": end,
                    "target": target,
                    "depth": depth,
                    "lasti": lasti
                });
            }
            exception_entries.forEach(entry => {
                for (let i = entry.start; i < entry.end; i++) {
                    labels.add(entry.target);
                }
            })
        }

        // _disassemble_bytes
        let max_offset = code.value.length - 2;
        let offset_width = max_offset >= 10000 ? max_offset.toString().length : 4;

        // line lookup
        let final_object = opargs.slice(-1)[0].offset;
        let line_map = {};
        {
            let last_offset = 0;
            let last_line = firstlineno;
            Object.entries(linestarts).forEach(linestart => {
                for (let offset = last_offset; offset < linestart[0]; offset++) {
                    line_map[offset] = last_line;
                };
                last_offset = linestart[0];
                last_line = linestart[1];
            })
            for (let offset = last_offset; offset <= final_object; offset++) {
                line_map[offset] = last_line;
            };
        }
        // print dis
        let source_code_stack = [];
        let module_counter = 0;
    
        // opcode process
        function op1(symbol, TOS, priority) {
            let TOS_repr = real_repr(TOS);
            if (get_priority(TOS) > priority){
                TOS_repr = `(${TOS_repr})`;
            }
            let expr = `${symbol}${TOS_repr}`;
            return {"type": "expression", "repr": expr, "priority": priority};
        }
        function op2(TOS1, symbol, TOS, priority, right_asso=false) {
            let cond;
            let TOS1_repr = real_repr(TOS1);
            let TOS_repr = real_repr(TOS);
            if (right_asso) {
                if (get_priority(TOS1) >= priority) {
                    TOS1_repr = `(${TOS1_repr})`;
                }
                if (get_priority(TOS) > priority) {
                    TOS_repr = `(${TOS_repr})`;
                }
            } else {
                if (get_priority(TOS1) > priority) {
                    TOS1_repr = `(${TOS1_repr})`;
                }
                if (get_priority(TOS) >= priority) {
                    TOS_repr = `(${TOS_repr})`;
                }
            }
            if (cond){
                expr = `(${expr})`;
            }
            let expr = `${TOS1_repr} ${symbol} ${TOS_repr}`;
            return {"type": "expression", "repr": expr, "priority": priority};
        }

        function add_scope(type, start, end, istart, iend) {
            scope_entries.push({
                "type": type,
                "start": start,
                "end": end,
                "istart": istart,
                "iend": iend,
            })
        }
    
        function process_name(offset, item, lvalue) {
            // console.debug("process_name", offset, item, varname);
            // processing varname = item
            if (item.type === "module") {
                if (item.import_name === null) {
                    add_expression(offset, {
                        "type": "statement",
                        "repr": `import ${item.module_name}${item.module_name !== lvalue ? ` as ${lvalue}` : ""}`
                    });
                } else {
                    let module = source_code_stack.pop();
                    // peek
                    let peek = null;
                    if (source_code.length) {
                        peek = source_code.pop();
                    }
                    if (peek !== null && peek.entry.type === "import_statement" && peek.entry.module_id === item.module_id) {
                        // merge
                        add_expression(offset, {
                            "type": "import_statement",
                            "repr": `${real_repr(peek.entry)}, ${item.import_name}${item.import_name !== lvalue ? ` as ${lvalue}` : ""}`, "module_id": item.module_id
                        });
                    } else {
                        if (peek !== null) {
                            // return
                            add_expression(peek.offset, peek.entry);
                        }
                        add_expression(offset, {
                            "type": "import_statement",
                            "repr": `from ${item.module_name} import ${item.import_name}${item.import_name !== lvalue ? ` as ${lvalue}` : ""}`,
                            "module_id": item.module_id
                        });
                    }
                    source_code_stack.push(module);
                }
            } else if (item.type === "function") {
                add_expression(offset, {
                    "type": "statement",
                    "repr": `def ${lvalue}(???):`
                });
            } else if (item.type === "unpacked_expression") {
                item.children.push(lvalue);
                if (item.children.length === item.num) {
                    if (item.ex) {
                        item.children.pop();
                        item.children.push("*" + lvalue);
                    } else {
                        add_expression(offset, {
                            "type": "statement",
                            "repr": `${item.children.join(", ")} = ${real_repr(item)}`
                        });
                    }
                } else {
                    // not fully fed
                    source_code_stack.push(item);
                }
            } else if (item.type === "inplace_expression") {
                add_expression(offset, {
                    "type": "statement",
                    "repr": real_repr(item)
                });
            } else if (item.type === "for_expression") {
                add_expression(offset, {
                    "type": "statement",
                    "repr": `for ${lvalue} in ${real_repr(item)}:`
                });
                add_scope("for", item.start, item.end, offset + 1, item.end);
            } else {
                add_expression(offset, {
                    "type": "statement",
                    "repr": `${lvalue} = ${real_repr(item)}`
                });
            }
        }

        function add_expression(offset, expression) {
            let line_number = (Object.entries(linestarts).filter(x => offset >= x[0]).slice(-1)[0] ?? [null, null])[1];
            source_code.push({
                "lineno": line_number,
                "offset": offset,
                "entry": expression
            });
        }
        
        opargs.forEach(item => {
            // _get_instructions_bytes
            let starts_line = linestarts[item.offset] ?? null;
            let line_number = (Object.entries(linestarts).filter(x => item.offset >= x[0]).slice(-1)[0] ?? [null, null])[1];
            if (starts_line !== null && item.offset > 0) {
                // extra line break in opcode
                lines.push("");
            }
            let opcode = opcode_list["opmap"][item.opcode] ?? `<${item.opcode}>`;
            console.debug(line_number, opcode, item);
            let arg = item.arg;
            let argrepr = "";
            if (item.arg !== null) {
                if (opcode_list["hasconst"].includes(item.opcode)) {
                    if (arg >= 0 && arg < consts.children.length) {
                        argrepr = consts.children[arg].repr;
                    }
                } else if (opcode_list["hasname"].includes(item.opcode)) {
                    if (array_compare(version, [3, 11]) >= 0 && opcode === "LOAD_GLOBAL") {
                        if (arg >= 0 && (arg >> 1) < names.children.length) {
                            argrepr = names.children[arg >> 1].str;
                        } else {
                            argrepr = (arg >> 1).toString();
                        }
                        if (arg & 1) {
                            if (array_compare(version, [3, 13]) >= 0) {
                                argrepr = argrepr + " + NULL";
                            } else {
                                argrepr = "NULL + " + argrepr;
                            }
                        }
                    } else if (array_compare(version, [3, 12]) >= 0 && opcode === "LOAD_ATTR") {
                        if (arg >= 0 && (arg >> 1) < names.children.length) {
                            argrepr = names.children[arg >> 1].str;
                        } else {
                            argrepr = (arg >> 1).toString();
                        }
                        if (arg & 1) {
                            if (array_compare(version, [3, 13]) >= 0) {
                                argrepr = argrepr + " + NULL|self";
                            } else {
                                argrepr = "NULL|self + " + argrepr;
                            }
                        }
                    } else if (array_compare(version, [3, 12]) >= 0 && opcode === "LOAD_SUPER_ATTR") {
                        if (arg >= 0 && (arg >> 2) < names.children.length) {
                            argrepr = names.children[arg >> 2].str;
                        } else {
                            argrepr = (arg >> 2).toString();
                        }
                        if (arg & 1) {
                            if (array_compare(version, [3, 13]) >= 0) {
                                argrepr = argrepr + " + NULL|self";
                            } else {
                                argrepr = "NULL|self + " + argrepr;
                            }
                        }
                    } else {
                        if (arg >= 0 && arg < names.children.length) {
                            argrepr = names.children[arg].str;
                        } else {
                            argrepr = arg.toString();
                        }
                    }
                } else if (array_compare(version, [3, 10]) >= 0 && opcode_list["hasjabs"].includes(item.opcode)) {
                    argrepr = `to ${arg * 2}`;
                } else if (opcode_list["hasjrel"].includes(item.opcode)) {
                    var signed_arg = arg;
                    if (array_compare(version, [3, 11]) >= 0) {
                        if (opcode.indexOf('JUMP_BACKWARD') >= 0) {
                            signed_arg = -signed_arg;
                        }
                    }
                    if (array_compare(version, [3, 10]) >= 0) {
                        var argval = item.offset + 2 + signed_arg * 2;
                        if (array_compare(version, [3, 12]) >= 0) {
                            argval += 2 * (inline_cache_entries[opcode] ?? 0);
                        }
                        argrepr = `to ${argval}`;
                    } else if (array_compare(version, [3, 6]) >= 0) {
                        argrepr = `to ${item.offset + 2 + signed_arg}`;
                    } else {
                        argrepr = `to ${item.offset + 3 + signed_arg}`;
                    }
                } else if (array_compare(version, [3, 13]) >= 0 && ["LOAD_FAST_LOAD_FAST", "STORE_FAST_LOAD_FAST", "STORE_FAST_STORE_FAST"].includes(opcode)) {
                    var arg1 = arg >> 4;
                    var arg2 = arg & 15;
                    var argrepr1, argrepr2;
                    if (arg1 >= 0 && arg1 < localsplusnames.children.length) {
                        argrepr1 = localsplusnames.children[arg1].str;
                    } else {
                        argrepr1 = arg1.toString();
                    }
                    if (arg2 >= 0 && arg2 < localsplusnames.children.length) {
                        argrepr2 = localsplusnames.children[arg2].str;
                    } else {
                        argrepr2 = arg2.toString();
                    }
                    argrepr = argrepr1 + ", " + argrepr2;
                } else if (opcode_list["haslocal"].includes(item.opcode)) {
                    if (array_compare(version, [3, 11]) >= 0) {
                        if (arg >= 0 && arg < localsplusnames.children.length) {
                            argrepr = localsplusnames.children[arg].str;
                        } else {
                            argrepr = arg.toString();
                        }
                    } else {
                        if (arg >= 0 && arg < varnames.children.length) {
                            argrepr = varnames.children[arg].str;
                        } else {
                            argrepr = arg.toString();
                        }
                    }
                } else if (opcode_list["hascompare"].includes(item.opcode)) {
                    let actual_arg;
                    let to_bool = false;
                    if (array_compare(version, [3, 13]) >= 0) {
                        actual_arg = arg >> 5;
                        to_bool = (arg & 16) === 16;
                    } else if (array_compare(version, [3, 12]) >= 0) {
                        actual_arg = arg >> 4;
                    } else {
                        actual_arg = arg;
                    }
                    if (array_compare(version, [3, 12]) >= 0) {
                        argrepr = ['<', '<=', '==', '!=', '>', '>='][actual_arg] ?? `<${arg}>`;
                    } else {
                        argrepr = ['<', '<=', '==', '!=', '>', '>=', 'in', 'not in', 'is', 'is not', 'exception match', 'BAD'][actual_arg] ?? `<${arg}>`; // only up to >= for 3.9 thereafter
                    }
                    if (to_bool) {
                        argrepr = `bool(${argrepr})`;
                    }
                } else if (opcode_list["hasfree"].includes(item.opcode)) {
                    if (array_compare(version, [3, 11] >= 0)) {
                        if (arg >= 0 && arg < localsplusnames.children.length) {
                            argrepr = localsplusnames.children[arg].str;
                        } else {
                            argrepr = arg.toString();
                        }
                    } else {
                        if (arg >= 0 && arg < cellvars.children.length) {
                            argrepr = cellvars.children[arg].str;
                        } else {
                            argrepr = arg.toString();
                        }
                    }
                } else if (array_compare(version, [3, 3]) >= 0 && array_compare(version, [3, 11]) <= 0 && opcode_list["hasnargs"].includes(item.opcode)) { // removed in 3.6
                    argrepr = `${arg % 256} positional, ${arg >> 8} keyword pair`;
                } else if (opcode === "FORMAT_VALUE" || opcode === "CONVERT_VALUE") {
                    argrepr = ['', 'str', 'repr', 'ascii'][arg & 0x3];
                    if (arg & 0x4) {
                        if (argrepr !== "") {
                            argrepr += ", ";
                        }
                        argrepr += "with format";
                    }
                } else if (opcode === "MAKE_FUNCTION" || opcode === "SET_FUNCTION_ATTRIBUTE") { // added in 3.8, 3.13
                    argrepr = ['defaults', 'kwdefaults', 'annotations', 'closure'].filter((_, index) => arg & (1 << index)).join(", ");
                } else if (opcode === "BINARY_OP") { // added in 3.11
                    argrepr = arg < 26 ? (
                        ['+', '&', '//', '<<', '@', '*', '%', '|', '**', '>>', '-', '/', '^'][arg % 13] +
                        (arg >= 13 ? "=" : "")
                    ) : `<${arg}>`;
                } else if (opcode === "CALL_INTRINSIC_1") { // added in 3.12
                    argrepr = [
                        "INTRINSIC_1_INVALID",
                        "INTRINSIC_PRINT",
                        "INTRINSIC_IMPORT_STAR",
                        "INTRINSIC_STOPITERATION_ERROR",
                        "INTRINSIC_ASYNC_GEN_WRAP",
                        "INTRINSIC_UNARY_POSITIVE",
                        "INTRINSIC_LIST_TO_TUPLE",
                        "INTRINSIC_TYPEVAR",
                        "INTRINSIC_PARAMSPEC",
                        "INTRINSIC_TYPEVARTUPLE",
                        "INTRINSIC_SUBSCRIPT_GENERIC",
                        "INTRINSIC_TYPEALIAS",
                    ][arg] ?? `<${arg}>`;
                } else if (opcode === "CALL_INTRINSIC_2") { // added in 3.12
                    argrepr = [
                        "INTRINSIC_2_INVALID",
                        "INTRINSIC_PREP_RERAISE_STAR",
                        "INTRINSIC_TYPEVAR_WITH_BOUND",
                        "INTRINSIC_TYPEVAR_WITH_CONSTRAINTS",
                        "INTRINSIC_SET_FUNCTION_TYPE_PARAMS",
                    ][arg] ?? `<${arg}>`;
                }
            }
            let fields = [
                starts_line === null ? "   " : starts_line.toString().padStart(3),
                "   ", // mark_as_current: "-->"
                labels.has(item.offset) ? ">>" : "  ", // is_jump_target
                item.offset.toString().padStart(offset_width),
                opcode.padEnd(20),
                arg === null ? "" : arg.toString().padStart(5),
                (arg === null || argrepr === "") ? "" : `(${argrepr})`
            ]
            if (opcode !== "CACHE" || show_caches) {
                lines.push(fields.join(" ").trimEnd());
            }
            try {
                // process opcode (check Python/bytecodes.c)
                switch (opcode) {
                    case "EXTENDED_ARG": break;
                    case "PUSH_NULL": { // 3.11+
                        source_code_stack.push({"type": "NULL", "repr": "NULL"});
                        break;
                    }
                    case "POP_TOP": {
                        let temp_item = source_code_stack.pop();
                        if (temp_item.type !== "module") {
                            add_expression(item.offset, temp_item);
                        }
                        break;
                    }
                    case "ROT_TWO": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(TOS);
                        source_code_stack.push(TOS1);
                        break;
                    }
                    case "ROT_THREE": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        let TOS2 = source_code_stack.pop();
                        source_code_stack.push(TOS);
                        source_code_stack.push(TOS2);
                        source_code_stack.push(TOS1);
                        break;
                    }
                    case "ROT_FOUR": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        let TOS2 = source_code_stack.pop();
                        let TOS3 = source_code_stack.pop();
                        source_code_stack.push(TOS);
                        source_code_stack.push(TOS3);
                        source_code_stack.push(TOS2);
                        source_code_stack.push(TOS1);
                        break;
                    }
                    case "COPY": {
                        console.assert(arg > 0);
                        source_code_stack.push(source_code_stack[source_code_stack.length - arg]);
                        break;
                    }
                    case "SWAP": {
                        let temp = source_code_stack[source_code_stack.length - arg];
                        source_code_stack[source_code_stack.length - arg] = source_code_stack[source_code_stack.length - 1];
                        source_code_stack[source_code_stack.length - 1] = temp;
                        break;
                    }
                    case "DUP_TOP": {
                        let temp_item = source_code_stack.pop();
                        source_code_stack.push(temp_item);
                        source_code_stack.push(temp_item);
                        break;
                    }
                    case "DUP_TOP_TWO": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(TOS1);
                        source_code_stack.push(TOS);
                        source_code_stack.push(TOS1);
                        source_code_stack.push(TOS);
                        break;
                    }
                    case "IMPORT_NAME": {
                        let fromlist = source_code_stack.pop();
                        let level = source_code_stack.pop();
                        let varname = names.children[arg].str;
                        source_code_stack.push({"type": "module", "repr": `<module '${varname}'>`, "module_name": varname, "import_name": null, "module_id": module_counter++});
                        break;
                    }
                    case "IMPORT_FROM": {
                        let module = source_code_stack.pop();
                        let varname = names.children[arg].str;
                        source_code_stack.push(module);
                        source_code_stack.push({"type": "module", "repr": `<module '${module.module_name}.${varname}'>`, "module_name": module.module_name, "import_name": varname, "module_id": module.module_id});
                        break;
                    }
                    case "IMPORT_STAR": {
                        let module = source_code_stack.pop();
                        add_expression(item.offset, {
                            "type": "import_statement",
                            "repr": `from ${module.module_name} import *`,
                            "module_id": module.module_id
                        });
                        break;
                    }
                    case "LOAD_CONST": {
                        source_code_stack.push(consts.children[arg]);
                        break;
                    }
                    case "LOAD_NAME": {
                        let varname = names.children[arg].str;
                        source_code_stack.push({"type": "expression", "repr": varname, "priority": 0});
                        break;
                    }
                    case "LOAD_FAST": {
                        let varname;
                        if (array_compare(version, [3, 11]) >= 0) {
                            varname = localsplusnames.children[arg].str;
                        } else {
                            varname = varnames.children[arg].str;
                        }
                        source_code_stack.push({"type": "expression", "repr": varname, "priority": 0});
                        break;
                    }
                    case "LOAD_FAST_LOAD_FAST": { // 3.13
                        let varname1 = localsplusnames.children[arg >> 4].str;
                        let varname2 = localsplusnames.children[arg & 15].str;
                        source_code_stack.push({"type": "expression", "repr": varname1, "priority": 0});
                        source_code_stack.push({"type": "expression", "repr": varname2, "priority": 0});
                        break;
                    }
                    case "LOAD_CLOSURE": {
                        let varname;
                        if (array_compare(version, [3, 11]) >= 0) { // same as LOAD_FAST
                            varname = localsplusnames.children[arg].str;
                        } else {
                            varname = cellvars.children[arg].str;
                        }
                        source_code_stack.push({"type": "expression", "repr": varname, "priority": 0});
                        break;
                    }
                    case "LOAD_DEREF": {
                        let varname;
                        if (array_compare(version, [3, 11]) >= 0) {
                            varname = localsplusnames.children[arg].str;
                        } else {
                            varname = varnames.children[arg].str;
                        }
                        source_code_stack.push({"type": "expression", "repr": varname, "priority": 0});
                        break;
                    }
                    case "LOAD_GLOBAL": {
                        let varname;
                        let push_null = false;
                        if (array_compare(version, [3, 11]) >= 0) {
                            if (arg & 1) {
                                push_null = true;
                            }
                            varname = names.children[arg >> 1].str;
                        } else {
                            varname = names.children[arg].str;
                        }
                        if (push_null & array_compare(version, [3, 13]) < 0) {
                            source_code_stack.push({"type": "NULL", "repr": "NULL"});
                        }
                        source_code_stack.push({"type": "expression", "repr": varname, "priority": 0});
                        if (push_null & array_compare(version, [3, 13]) >= 0) {
                            source_code_stack.push({"type": "NULL", "repr": "NULL"});
                        }
                        break;
                    }
                    case "LOAD_ATTR": {
                        let TOS = source_code_stack.pop();
                        let name;
                        let push_null = false;
                        if (array_compare(version, [3, 12]) >= 0) {
                            if (arg & 1) {
                                push_null = true;
                            }
                            name = names.children[arg >> 1].str;
                        } else {
                            name = names.children[arg].str;
                        }
                        let TOS_repr = real_repr(TOS);
                        if (get_priority(TOS) > 2) {
                            TOS_repr = `(${TOS_repr})`;
                        }
                        if (push_null & array_compare(version, [3, 13]) < 0) {
                            // NULL just as an unbound method
                            source_code_stack.push({"type": "NULL", "repr": "NULL"});
                        }
                        source_code_stack.push({"type": "expression", "repr": `${TOS_repr}.${name}`, "priority": 2});
                        if (push_null & array_compare(version, [3, 13]) >= 0) {
                            source_code_stack.push({"type": "NULL", "repr": "NULL"});
                        }
                        break;
                    }
                    case "LOAD_METHOD": { // since 3.7
                        let TOS = source_code_stack.pop();
                        let TOS_repr = real_repr(TOS);
                        if (get_priority(TOS) > 2) {
                            TOS_repr = `(${TOS_repr})`;
                        }
                        let name = names.children[arg].str;
                        if (array_compare(version, [3, 11]) >= 0) {
                            // NULL just as an unbound method
                            source_code_stack.push({"type": "NULL", "repr": "NULL"});
                        }
                        source_code_stack.push({"type": "expression", "repr": `${TOS_repr}.${name}`, "priority": 2});
                        break;
                    }
                    case "LOAD_BUILD_CLASS": { 
                        source_code_stack.push({"type": "build_class_expression", "repr": "__build_class__"});
                        break;
                    }
                    case "STORE_NAME": {
                        let temp_item = source_code_stack.pop();
                        let varname = names.children[arg].str;
                        process_name(item.offset, temp_item, varname);
                        break;
                    }
                    case "STORE_FAST": {
                        let temp_item = source_code_stack.pop();
                        let varname;
                        if (array_compare(version, [3, 11]) >= 0) {
                            varname = localsplusnames.children[arg].str;
                        } else {
                            varname = varnames.children[arg].str;
                        }
                        process_name(item.offset, temp_item, varname);
                        break;
                    }
                    case "STORE_FAST_STORE_FAST": { // 3.13
                        let temp_item1 = source_code_stack.pop();
                        let temp_item2 = source_code_stack.pop();
                        let varname1 = localsplusnames.children[arg >> 4].str;
                        let varname2 = localsplusnames.children[arg & 15].str;
                        process_name(item.offset, temp_item1, varname1);
                        process_name(item.offset, temp_item2, varname2);
                        break;
                    }
                    case "STORE_DEREF": {
                        let temp_item = source_code_stack.pop();
                        let varname;
                        if (array_compare(version, [3, 11]) >= 0) {
                            varname = localsplusnames.children[arg].str;
                        } else {
                            varname = varnames.children[arg].str;
                        }
                        process_name(item.offset, temp_item, varname);
                        break;
                    }
                    case "STORE_GLOBAL": {
                        let temp_item = source_code_stack.pop();
                        let varname = names.children[arg].str;
                        process_name(item.offset, temp_item, varname);
                        break;
                    }
                    case "STORE_ATTR": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        let TOS_repr = real_repr(TOS);
                        if (get_priority(TOS) > 2) {
                            TOS_repr = `(${TOS_repr})`;
                        }
                        let name = names.children[arg].str;
                        process_name(item.offset, TOS1, `${TOS_repr}.${name}`);
                        break;
                    }
                    case "STORE_SUBSCR": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        let TOS1_repr = real_repr(TOS1);
                        if (get_priority(TOS1) > 2) {
                            TOS1_repr = `(${TOS1_repr})`;
                        }
                        let TOS2 = source_code_stack.pop();
                        process_name(item.offset, TOS2, `${TOS1_repr}[${subscr_repr(TOS)}]`);
                        break;
                    }
                    case "UNPACK_SEQUENCE": {
                        let TOS = source_code_stack.pop();
                        source_code_stack.push({"type": "unpacked_expression", "repr": real_repr(TOS), "num": arg, "ex": false, "children": []});
                        break;
                    }
                    case "UNPACK_EX": {
                        let TOS = source_code_stack.pop();
                        source_code_stack.push({"type": "unpacked_expression", "repr": real_repr(TOS), "num": arg + 1, "ex": true, "children": []});
                        break;
                    }
                    case "COMPARE_OP": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        let actual_arg;
                        if (array_compare(version, [3, 13]) >= 0) {
                            actual_arg = arg >> 5;
                            // coerced to bool if opname & 16
                        } else if (array_compare(version, [3, 12]) >= 0) {
                            actual_arg = arg >> 4;
                        } else {
                            actual_arg = arg;
                        }
                        source_code_stack.push(op2(TOS1, ['<', '<=', '==', '!=', '>', '>=', 'in', 'not in', 'is', 'is not', 'exception match', 'BAD'][actual_arg] ?? `<${arg}>`, TOS, 12));
                        break;
                    }
                    case "BINARY_OP": { // 3.11
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        let operator = arg < 26 ? ['+', '&', '//', '<<', '@', '*', '%', '|', '**', '>>', '-', '/', '^'][arg % 13] : `<${arg}>`;
                        let inplace = arg >= 13 && arg < 26;
                        if (inplace) {
                            source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} ${operator}= ${real_repr(TOS)}`});
                        } else {
                            let precedence = [7, 9, 6, 8, 6, 6, 6, 11, 4, 8, 7, 6, 10][arg];
                            source_code_stack.push(op2(TOS1, operator, TOS, precedence));
                        }
                        break;
                    }
                    case "UNARY_POSITIVE": {
                        source_code_stack.push(op1("+", source_code_stack.pop(), 5));
                        break;
                    }
                    case "UNARY_NEGATIVE": {
                        source_code_stack.push(op1("-", source_code_stack.pop(), 5));
                        break;
                    }
                    case "UNARY_NOT": {
                        source_code_stack.push(op1("not ", source_code_stack.pop(), 13));
                        break;
                    }
                    case "UNARY_INVERT": {
                        source_code_stack.push(op1("~", source_code_stack.pop(), 5));
                        break;
                    }
                    case "BINARY_POWER": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "**", TOS, 4, true));
                        break;
                    }
                    case "BINARY_MULTIPLY": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "*", TOS, 6));
                        break;
                    }
                    case "BINARY_MATRIX_MULTIPLY": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "@", TOS, 6));
                        break;
                    }
                    case "BINARY_FLOOR_DIVIDE": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "//", TOS, 6));
                        break;
                    }
                    case "BINARY_TRUE_DIVIDE": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "/", TOS, 6));
                        break;
                    }
                    case "BINARY_DIVIDE": { // Python 2
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "/", TOS, 6));
                        break;
                    }
                    case "BINARY_MODULO": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "%", TOS, 6));
                        break;
                    }
                    case "BINARY_ADD": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "+", TOS, 7));
                        break;
                    }
                    case "BINARY_SUBTRACT": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "-", TOS, 7));
                        break;
                    }
                    case "BINARY_SUBSCR": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        let TOS1_repr = real_repr(TOS1);
                        if (get_priority(TOS1) > 2) {
                            TOS1_repr = `(${TOS1_repr})`;
                        }
                        source_code_stack.push({"type": "expression", "repr": `${TOS1_repr}[${subscr_repr(TOS)}]`, "priority": 2});
                        break;
                    }
                    case "BINARY_SLICE": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        let TOS2 = source_code_stack.pop();
                        let TOS2_repr = real_repr(TOS2);
                        if (get_priority(TOS2) > 2) {
                            TOS2_repr = `(${TOS2_repr})`;
                        }
                        source_code_stack.push({"type": "expression", "repr": `${TOS2_repr}[${subscr_repr({
                            "type": "slice",
                            "repr": `slice(${real_repr(TOS1)}, ${real_repr(TOS)}, ${real_repr(None)})`,
                            "start": TOS1,
                            "stop": TOS,
                            "step": None
                        })}]`, "priority": 2});
                        break;
                    }
                    case "BINARY_LSHIFT": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "<<", TOS, 8));
                        break;
                    }
                    case "BINARY_RSHIFT": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, ">>", TOS, 8));
                        break;
                    }
                    case "BINARY_AND": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "&", TOS, 9));
                        break;
                    }
                    case "BINARY_XOR": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "^", TOS, 10));
                        break;
                    }
                    case "BINARY_OR": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push(op2(TOS1, "|", TOS, 11));
                        break;
                    }
                    case "INPLACE_POWER": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} **= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_MULTIPLY": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} *= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_MATRIX_MULTIPLY": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} @= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_FLOOR_DIVIDE": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} //= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_TRUE_DIVIDE": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} /= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_MODULO": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} %= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_ADD": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} += ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_SUBTRACT": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} -= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_LSHIFT": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} <<= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_RSHIFT": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} >>= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_AND": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} &= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_XOR": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} ^= ${real_repr(TOS)}`});
                        break;
                    }
                    case "INPLACE_OR": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        source_code_stack.push({"type": "inplace_expression", "repr": `${real_repr(TOS1)} |= ${real_repr(TOS)}`});
                        break;
                    }
                    case "DELETE_SUBSCR": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        add_expression(item.offset, {"type": "statement", "repr": `del ${real_repr(TOS1)}[${real_repr(TOS)}]`});
                        break;
                    }
                    case "RAISE_VARARGS": {
                        // TODO: handle assert also
                        switch (arg) {
                            case 0: {
                                add_expression(item.offset, {"type": "statement", "repr": `raise`});
                                break;
                            }
                            case 1: {
                                let TOS = source_code_stack.pop();
                                add_expression(item.offset, {"type": "statement", "repr": `raise ${real_repr(TOS)}`});
                                break;
                            }
                            case 2: {
                                let TOS = source_code_stack.pop();
                                let TOS1 = source_code_stack.pop();
                                add_expression(item.offset, {"type": "statement", "repr": `raise ${real_repr(TOS1)} from ${real_repr(TOS)}`});
                                break;
                            }
                        }
                        break;
                    }
                    case "BUILD_SLICE": {
                        switch (arg) {
                            case 2: {
                                let TOS = source_code_stack.pop();
                                let TOS1 = source_code_stack.pop();
                                source_code_stack.push({
                                    "type": "slice",
                                    "repr": `slice(${real_repr(TOS1)}, ${real_repr(TOS)}, ${real_repr(None)})`,
                                    "start": TOS1,
                                    "stop": TOS,
                                    "step": None
                                });
                                break;
                            }
                            case 3: {
                                let TOS = source_code_stack.pop();
                                let TOS1 = source_code_stack.pop();
                                let TOS2 = source_code_stack.pop();
                                source_code_stack.push({
                                    "type": "slice",
                                    "repr": `slice(${real_repr(TOS2)}, ${real_repr(TOS1)}, ${real_repr(TOS)})`,
                                    "start": TOS2,
                                    "stop": TOS1,
                                    "step": TOS
                                });
                                break;
                            }
                            default: {
                                console.assert(false, "invalid BUILD_SLICE argument: " + arg);
                            }
                        }
                        break;
                    }
                    case "BUILD_TUPLE": {
                        let elements = [];
                        for (let i = 0; i < arg; ++i) {
                            elements.unshift(source_code_stack.pop());
                        }
                        source_code_stack.push({"type": "tuple", "children": elements, "repr": `(${elements.map(e => real_repr(e)).join(", ")}${arg === 1 ? "," : ""})`});
                        break;
                    }
                    case "BUILD_LIST": {
                        let elements = [];
                        for (let i = 0; i < arg; ++i) {
                            elements.unshift(source_code_stack.pop());
                        }
                        source_code_stack.push({"type": "list", "children": elements, "repr": `[${elements.map(e => real_repr(e)).join(", ")}]`});
                        break;
                    }
                    case "BUILD_SET": {
                        let elements = [];
                        for (let i = 0; i < arg; ++i) {
                            elements.unshift(source_code_stack.pop());
                        }
                        source_code_stack.push({"type": "set", "children": elements, "repr": `{${elements.map(e => real_repr(e)).join(", ")}}`});
                        break;
                    }
                    case "BUILD_CONST_KEY_MAP": {
                        let keys = source_code_stack.pop();
                        let elements = [];
                        for (let i = 0; i < arg; ++i) {
                            elements.unshift(source_code_stack.pop());
                        }
                        let temp = [];							
                        for (let i = 0; i < arg; ++i) {
                            temp.push(`${real_repr(keys.children[i])}: ${real_repr(elements[i])}`);
                        }
                        source_code_stack.push({"type": "dict", "keys": keys.children, "values": elements, "repr": `{${temp.join(", ")}}`});
                        break;
                    }
                    case "BUILD_MAP": {
                        let elements = [];
                        for (let i = 0; i < 2 * arg; ++i) {
                            elements.unshift(source_code_stack.pop());
                        }
                        let temp = [];
                        let keys = [];
                        let values = [];
                        for (let i = 0; i < 2 * arg; i += 2) {
                            keys.push(elements[i]);
                            values.push(elements[i + 1]);
                            temp.push(`${real_repr(elements[i])}: ${real_repr(elements[i + 1])}`);
                        }
                        source_code_stack.push({"type": "dict", "keys": keys, "values": elements, "repr": `{${temp.join(", ")}}`});
                        break;
                    }
                    case "LIST_EXTEND": {
                        let seq = source_code_stack.pop();
                        let target = source_code_stack[source_code_stack.length - arg];
                        target.children.push(...seq.children);
                        target.repr = `[${target.children.map(e => real_repr(e)).join(", ")}]`;
                        break;
                    }
                    case "SET_UPDATE": {
                        let seq = source_code_stack.pop();
                        let target = source_code_stack[source_code_stack.length - arg];
                        target.children.push(...seq.children);
                        target.repr = `{${target.children.map(e => real_repr(e)).join(", ")}}`;
                        break;
                    }
                    case "RETURN_VALUE":
                    case "RETURN_CONST": { // 3.12 onwards
                        let value;
                        if (opcode === "RETURN_VALUE") {
                            value = source_code_stack.pop();
                        } else if (opcode === "RETURN_CONST") {
                            value = consts.children[arg];
                        } else {
                            console.assert(false, "Unknown opcode: " + opcode);
                            break;
                        }
                        if (value.type === "NoneType") {
                            add_expression(item.offset, {"type": "statement", "repr": `return`});
                        } else {
                            add_expression(item.offset, {"type": "statement", "repr": `return ${real_repr(value)}`});
                        }
                        break;
                    }
                    case "GET_ITER": {
                        let TOS = source_code_stack.pop();
                        source_code_stack.push({"type": "iterator", "repr": `${real_repr(TOS)}`});
                        break;
                    }
                    case "FOR_ITER": {
                        let TOS = source_code_stack.pop();
                        let end_offset;
                        let signed_arg = item.arg;
                        if (array_compare(version, [3, 10]) >= 0) {
                            if (array_compare(version, [3, 11]) >= 0) {
                                if (opcode.indexOf("JUMP_BACKWARD") === 0) {
                                    signed_arg = -signed_arg;
                                }
                            }
                            end_offset = item.offset + 2 + signed_arg * 2;
                            if (array_compare(version, [3, 12]) >= 0) {
                                end_offset += 2 * (inline_cache_entries[opcode] ?? 0);
                            }
                        } else if (array_compare(version, [3, 6]) >= 0) {
                            end_offset = item.offset + 2 + signed_arg;
                        } else  {
                            end_offset = item.offset + 3 + signed_arg;
                        }
                        source_code_stack.push({"type": "for_expression", "repr": `${real_repr(TOS)}`, "start": item.offset, "end": end_offset});
                        break;
                    }
                    case "KW_NAMES": { // since 3.11
                        let constant = consts.children[arg]; // expected Tuple[str]
                        source_code_stack.push({"type": "KW_NAMES", "content": constant});
                        break;
                    }
                    case "CALL": { // since 3.11
                        let kw_names = null;
                        if (source_code_stack.length > 0) {
                            let temp = source_code_stack.pop();
                            if (temp.type === "KW_NAMES") {
                                kw_names = temp.content;
                            } else {
                                source_code_stack.push(temp);
                            }
                        }
                        let elements = [];
                        for (let i = 0; i < arg; ++i) {
                            elements.unshift(source_code_stack.pop());
                        }
                        let callable = null;
                        let self_or_null_is_null = null;
                        if (array_compare(version, [3, 13]) >= 0) {
                            self_or_null_is_null = source_code_stack.pop().type === "NULL";
                            callable = source_code_stack.pop();
                        } else {
                            callable = source_code_stack.pop();
                            self_or_null_is_null = source_code_stack.pop();
                            if (self_or_null_is_null.type !== "NULL") {
                                callable = self_or_null_is_null;
                                self_or_null_is_null = false;
                            } else {
                                self_or_null_is_null = true;
                            }
                        }
                        let function_name = callable;
                        let kw_index = kw_names === null ? elements.length : (elements.length - kw_names.children.length);
                        let argument_str = [];
                        for (let i = 0; i < kw_index; ++i) {
                            argument_str.push(real_repr(elements[i]));
                        }
                        for (let i = kw_index; i < elements.length; ++i) {
                            argument_str.push(kw_names.children[i - kw_index].str + "=" + real_repr(elements[i]));
                        }
                        source_code_stack.push({"type": "expression", "repr": `${real_repr(function_name)}(${argument_str.join(", ")})`, "priority": 2});
                        break;
                    }
                    case "CALL_FUNCTION": {
                        let elements = [];
                        for (let i = 0; i < arg; ++i) {
                            elements.unshift(source_code_stack.pop());
                        }
                        let function_name = source_code_stack.pop();
                        source_code_stack.push({"type": "expression", "repr": `${real_repr(function_name)}(${elements.map(e => real_repr(e)).join(", ")})`, "priority": 2});
                        break;
                    }
                    case "CALL_METHOD": {
                        let elements = [];
                        for (let i = 0; i < arg; ++i) {
                            elements.unshift(source_code_stack.pop());
                        }
                        let function_name = source_code_stack.pop();
                        source_code_stack.push({"type": "expression", "repr": `${real_repr(function_name)}(${elements.map(e => real_repr(e)).join(", ")})`, "priority": 2});
                        break;
                    }
                    case "CALL_INTRINSIC_1": {
                        let TOS = source_code_stack.pop();
                        let function_name = [
                            "INTRINSIC_1_INVALID",
                            "INTRINSIC_PRINT",
                            "INTRINSIC_IMPORT_STAR",
                            "INTRINSIC_STOPITERATION_ERROR",
                            "INTRINSIC_ASYNC_GEN_WRAP",
                            "INTRINSIC_UNARY_POSITIVE",
                            "INTRINSIC_LIST_TO_TUPLE",
                            "INTRINSIC_TYPEVAR",
                            "INTRINSIC_PARAMSPEC",
                            "INTRINSIC_TYPEVARTUPLE",
                            "INTRINSIC_SUBSCRIPT_GENERIC",
                            "INTRINSIC_TYPEALIAS",
                        ][arg] ?? `<${arg}>`;
                        source_code_stack.push({"type": "expression", "repr": `${function_name}(${real_repr(TOS)})`, "priority": 2});
                        break;
                    }
                    case "CALL_INTRINSIC_2": {
                        let TOS = source_code_stack.pop();
                        let TOS1 = source_code_stack.pop();
                        let function_name = [
                            "INTRINSIC_2_INVALID",
                            "INTRINSIC_PREP_RERAISE_STAR",
                            "INTRINSIC_TYPEVAR_WITH_BOUND",
                            "INTRINSIC_TYPEVAR_WITH_CONSTRAINTS",
                            "INTRINSIC_SET_FUNCTION_TYPE_PARAMS",
                        ][arg] ?? `<${arg}>`;
                        source_code_stack.push({"type": "expression", "repr": `${function_name}(${real_repr(TOS1)}, ${real_repr(TOS)})`, "priority": 2});
                        break;
                    }
                    case "MAKE_FUNCTION": {
                        let qualified_name = null;
                        let function_code;
                        if (array_compare(version, [3, 11]) < 0) {
                            qualified_name = source_code_stack.pop();
                            function_code = source_code_stack.pop();
                        } else {
                            function_code = source_code_stack.pop();
                            console.assert(function_code.type === "code");
                            qualified_name = function_code.dict.qualname;
                        }
                        let argument_value = null;
                        if (array_compare(version, [3, 13]) < 0 && arg) { // flag
                            argument_value = source_code_stack.pop();
                        }
                        source_code_stack.push({"type": "function", "repr": `<function ${qualified_name.str} at 0x---------------->`, "arguments": argument_value, "code": function_code});
                        break;
                    }
                    case "SET_FUNCTION_ATTRIBUTE": {
                        let _function = source_code_stack.pop();
                        let argument_value = source_code_stack.pop();
                        source_code_stack.push(_function);
                        break;
                    }
                    case "YIELD_VALUE": {
                        let TOS = source_code_stack.pop();
                        add_expression(item.offset, {
                            "type": "statement",
                            "repr": `yield ${real_repr(TOS)}`
                        });
                        break;
                    }
                    case "NOP":
                    case "RESUME":
                    case "COPY_FREE_VARS":
                    case "CACHE":
                    case "MAKE_CELL":
                    case "PRECALL": 
                    case "RETURN_GENERATOR": {
                        /*
                            NOP
                                do nothing code.
                            RESUME
                                no-op. performs internal tracing, debugging and optimization checks.
                            COPY_FREE_VARS
                                Copies arg free variables from the closure into the frame.
                            CACHE
                                mark extra space for the interpreter to cache useful data directly in the bytecode itself
                            MAKE_CELL
                                creates a new cell in slot arg. If that slot is nonempty then that value is stored into the new cell.
                            PRECALL
                                Only in 3.11. Logically this is a no op.
                            RETURN_GENERATOR
                                3.11+, clear the current frame and return the newly created generator
                        */
                        break;
                    }
                    default: {
                        unsupported_opcodes.add(opcode);
                        source_code_stack.push({"type": "unknown", "repr": `${opcode}(${arg??""})`});
                        console.warn("Unhandled opcode", opcode, item);
                    }
                }
            } catch (error) {
                console.error(error);
            }
        })
        if (source_code_stack.length > 0) {
            source_code.push({
                "lineno": null,
                "offset": null,
                "entry": {
                    "type": "label",
                    "repr": "Leftover elements:"
                }
            })
            source_code_stack.forEach(x => source_code.push({
                "lineno": null,
                "offset": null,
                "entry": x
            }))
            source_code_stack.length = 0;
        }
        var indentations = {};
        scope_entries.forEach(entry => {
            // only store differences
            indentations[entry.istart] = (indentations[entry.istart] ?? 0) + 1;
            indentations[entry.iend] = (indentations[entry.iend] ?? 0) - 1;
        })
        indentations = Object.entries(indentations).sort((a, b) => a[0] - b[0]);
        var indent_cursor = 0;
        source_code.forEach(entry => {
            var total_delta = 0;
            while (indent_cursor < indentations.length && entry.offset >= indentations[indent_cursor][0]) {
                total_delta += indentations[indent_cursor][1];
                indent_cursor++;
            }
            entry.indent_delta = total_delta;
        })

        // exception entries
        if (exception_entries.length > 0) {
            lines.push(`ExceptionTable:`);
            exception_entries.forEach(entry => {
                var lasti = entry.lasti ? " lasti" : "";
                var end = entry.end - 2;
                lines.push(`  ${entry.start} to ${end} -> ${entry.target} [${entry.depth}]${lasti}`);
            })
        }
        if (unsupported_opcodes.size > 0) {
            lines.push(`==============================`);
            lines.push(` Currently Unsupported Opcodes `);
            lines.push(`------------------------------`);
            unsupported_opcodes.forEach(opcode => lines.push(`${opcode}`));
        }
        if (true) { // debug
            lines.push(`==============================`);
            lines.push(` Decompiled Code (Experimental, Jump Support not yet Implemented) `);
            lines.push(`------------------------------`);
            console.log(source_code);
            let maxline = source_code.filter(a => a.lineno !== null).map(a => a.lineno).reduce((a, b) => a > b ? a : b, 0);
            // let maxline = Math.max(...Object.values(linestarts));
            // let minline = source_code.reduce((a, b) => a.lineno > b.lineno ? b.lineno : a.lineno, 2147483648);
            // let minline = Math.min(...Object.values(linestarts));
            let line_digit = maxline < 10000 ? 4 : maxline.toString().length;
            // for (let line = minline; line <= maxline; ++line) {
            //     lines.push(`${line.toString().padStart(line_digit)} | ${source_code[line] ?? ""}`);
            // }
            var current_indent = 0;
            source_code.forEach(entry => {
                current_indent += entry.indent_delta;
                lines.push(`${(entry.lineno ?? "?").toString().padStart(line_digit)} | ${" ".repeat(current_indent * 4)}${(entry.entry ?? {"repr": "undefined"}).repr ?? ""}`);
            })
        }
    }
    return {"lines": lines, "source_code": source_code};
}

function array_compare(a, b) {
    var index = 0;
    while (true) {
        // both same length
        if (index >= a.length && index >= b.length) {
            return 0;
        }
        if (index >= a.length) {
            return -1;
        }
        if (index >= b.length) {
            return 1;
        }
        if (a[index] != b[index]) {
            return a[index] > b[index] ? 1 : -1;
        }
        ++index;
    }
}