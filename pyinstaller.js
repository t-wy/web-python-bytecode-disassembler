_type_codes = {
    'b': "BINARY",
    'd': "DEPENDENCY",
    'z': "PYZ",
    "Z": "ZIPFILE",
    "M": "PYPACKAGE",
    "m": "PYMODULE",
    "s": "PYSOURCE",
    "x": "DATA",
    "o": "RUNTIME_OPTION",
    "l": "SPLASH"
}
_type_codes_pyz = [
    "MODULE",
    "PKG",
    "DATA",
    "NSPKG"
]

async function handleBytes_pyinstaller(bytes, lines) {
    var children = [];
    // reference: pyinstaller/bootloader/.../pyi_archive.h 
    var hex = temp => "0x" + Array.from(temp).map(i => i.toString(16).padStart(2, "0")).join(",0x");
    // very likely to be near the end of the file, so scan by chunk
    var temp_end = bytes.length;
    var offset = -1;
    // _find_magic_pattern
    var _COOKIE_MAGIC_PATTERN = [0x4d, 0x45, 0x49, 0x0c, 0x0b, 0x0a, 0x0b, 0x0e]; // 'MEI\014\013\012\013\016'
    var target_hex = hex(_COOKIE_MAGIC_PATTERN);
    while (offset == -1) {
        var temp_start = temp_end - _COOKIE_MAGIC_PATTERN.length;
        if (temp_start < 0) {
            temp_start = 0;
        }
        var offset = hex(bytes.slice(temp_start, temp_end)).lastIndexOf(target_hex);
        if (offset !== -1) {
            offset = temp_start + offset / 5; // 5 = byte hex length
            break;
        };
        temp_end = temp_start + _COOKIE_MAGIC_PATTERN.length - 1;
        if (temp_start === 0) {
            break;
        }
    }
    // read CArchive Cookie
    var pyinstaller_version = null;
    var cookie_length;
    if (offset === -1) {
        throw new Error("PyInstaller not found.");
    }
    lines.push("PyInstaller Detected.");
    lines.push(`Cookie Position: ${offset} (0x${offset.toString(16)})`);
    if (String.fromCharCode(...bytes.slice(offset + 24, offset + 24 + 64)).toLowerCase().indexOf("python") !== -1) { // test python library name
        lines.push("PyInstaller version: 2.1+");
        pyinstaller_version = [2, 1];
        cookie_length = 24 + 64;
    } else {
        lines.push("PyInstaller version: 2.0");
        pyinstaller_version = [2, 0];
        cookie_length = 24;
    }

    var reader = new BigEndianReader(bytes);
    reader.seek(offset + 8); // skipped magic
    // originally int, changed to uint later
    var pkg_length = reader.readUInt(); // length of entire PKG archive
    var toc_offset = reader.readUInt(); // position of TOC relative to start of PKG archive
    var toc_length = reader.readUInt(); // length of TableOfContents
    var python_version = reader.readUInt(); // integer representing python version
    var python_libname = ""; // Name of the of Python shared library (null string)
    if (array_compare(pyinstaller_version, [2, 1]) >= 0) {
        python_libname = reader.readBytes(64);
        python_libname = String.fromCharCode(...python_libname.slice(0, python_libname.indexOf(0)));
        lines.push(`Python Library Name: ${python_libname}`);
    }
    let version = python_version >= 100 ? [Math.floor(python_version / 100), python_version % 100] : [Math.floor(python_version / 10), python_version % 10];
    lines.push(`Python Version: ${python_version} (${version.join(".")})`);
    let _start_offset = (offset + cookie_length) - pkg_length;

    var trailing_lines = [];
    trailing_lines.push("==============================");
    trailing_lines.push("Table of Contents:");

    // _parse_toc
    let toc = [];
    let cur_pos = _start_offset + toc_offset;
    reader.seek(cur_pos);
    while (cur_pos < _start_offset + toc_offset + toc_length) {
        let entry_length = reader.readUInt(); // length of this TOC entry, including full length of the name field
        let entry_offset = reader.readUInt(); // position of entry's data blob, relative to the start of PKG archive
        let data_length = reader.readUInt(); // length of compressed data blob
        let uncompressed_length = reader.readUInt(); // length of uncompressed data blob
        let compression_flag = reader.readByte(); // compression flag (1 = compressed, 0 = uncompressed)
        let typecode = reader.readByte(); // type code - see ARCHIVE_ITEM_* definitions
        let name = reader.readBytes(cur_pos + entry_length - reader.tell()); // entry name; padded to multiple of 16
        name = String.fromCharCode(...name.slice(0, name.indexOf(0)));
        cur_pos += entry_length;
        toc.push({
            "entry_offset": entry_offset,
            "data_length": data_length,
            "uncompressed_length": uncompressed_length,
            "compression_flag": compression_flag,
            "typecode": typecode,
            "name": name
        });
        trailing_lines.push(`${_type_codes[String.fromCharCode(typecode)]} ${name} (Size: ${uncompressed_length.toLocaleString("en")} Bytes, Packed Size: ${data_length.toLocaleString("en")} Bytes (${compression_flag ? "Compressed" : "Uncompressed"}))`);
    }

    var magic_header = null;
    var magic_header_pyz = null;
    var encryption_key = null;
    var patch_magic_list = [];
    var pyz_list = [];
    children = [];
    for (var i = 0; i < toc.length; i++) {
        let item = toc[i];
        let data = bytes.slice(_start_offset + item.entry_offset, _start_offset + item.entry_offset + item.data_length);
        let type_code = _type_codes[String.fromCharCode(item.typecode)];
        if (item.compression_flag) {
            data = await deflate_decompress(data);
        };
        let result = {
            "type": "file",
            "label": item.name,
            "value": data,
            "children": [],
            "show_hex": false,
            "content": [
                "Type: " + type_code,
            ],
            "hidden": ![
                "PYZ",
                "PYPACKAGE",
                "PYMODULE",
                "PYSOURCE",
            ].includes(type_code),
            "loaded": ![
                "PYZ",
                "PYPACKAGE",
                "PYMODULE",
                "PYSOURCE",
            ].includes(type_code)
        };
        if (item.name === "pyimod00_crypto_key") {
            // grab the key
            result.loaded = "loading";
            result.children = handleBytes_pyc(data, result.content);
            encryption_key = result.children[0].dict.consts.children[0].value;
            result.loaded = true;
        } else if (item.name === "PYZ-00.pyz") {
            magic_header_pyz = data.slice(4, 8);
        }
        if (["PYPACKAGE", "PYMODULE"].includes(type_code) && data[2] === 0x0d && data[3] === 0x0a) {
            if (magic_header === null) {
                magic_header = data.slice(0, 4);
            }
        } else if (type_code === "PYSOURCE") {
            patch_magic_list.push(result);
        };
        if (type_code === "PYZ") {
            pyz_list.push(result);
        }
        children.push(result);
    };

    if (encryption_key !== null) {
        lines.push(`Found Encryption Key: ${String.fromCharCode(...encryption_key)}`);
        pyz_list.forEach(child => child.encryption_key = encryption_key);
    }

    if (magic_header_pyz !== null) {
        let magic = (magic_header_pyz[1] << 8) | magic_header_pyz[0];
        let magic_version = get_python_version(magic);
        lines.push(`PYZ Magic Number: ${magic} (${magic_version.join(".")})`);
        if (array_compare(version, magic_version) === 0) {
            if (magic_header === null) {
                magic_header = magic_header_pyz;
                lines.push(`Set CArchive's Magic Number to be the same as PYZ, as they have the same Python Version while the former is not available.`);
            }
        } else {
            lines.push(`PYZ and CArchive have different Python Version!`);
        }
    }

    if (magic_header === null) {
        let magic = suggest_magic(version);
        if (magic !== null) {
            magic_header = new Uint8Array([magic & 255, magic >> 8, 0x0d, 0x0a]);
        }
    } else {
        let magic = (magic_header[1] << 8) | magic_header[0];
        let magic_version = get_python_version(magic);
        lines.push(`Python Magic Number: ${magic} (${magic_version.join(".")})`);
    }

    // assign magic
    if (magic_header !== null) {
        var total_header = 8;
        if (array_compare(version, [3, 7]) >= 0) {
            total_header = 16;
        } else if (array_compare(version, [3, 3]) >= 0) {
            total_header = 12;
        }
        patch_magic_list.forEach(child => {
            var new_value = new Uint8Array(total_header + child.value.length);
            new_value.set(magic_header, 0);
            new_value.set(child.value, total_header);
            child.value = new_value;
        })
    }

    trailing_lines.forEach(line => {
        lines.push(line);
    });
    return children;
}

async function handleBytes_pyinstaller_pyz(bytes, lines, encryption_key=null) {
    // PyInstaller/loader/pyimod01_archive.py
    var children = [];
    var reader = new BigEndianReader(bytes);
    var reader_le = new LittleEndianReader(bytes);
    let filemagic = reader.readInt();
    console.assert(filemagic === 0x50595a00); // _PYZ_MAGIC_PATTERN (b'PYZ\0')
    lines.push(`Magic Number: ${filemagic >>> 0} (0x${(filemagic >>> 0).toString(16).padStart(8, "0")})`); // unsigned
    let magic_header = reader.readBytes(4);
    let magic = magic_header[0] | (magic_header[1] << 8) | (magic_header[2] << 16) | (magic_header[3] << 24);
    let version;
    version = get_python_version(magic & 0x0000ffff);
    lines.push(`Python Magic Number: ${magic & 0x0000ffff} (${version.join(".")})`);
    var total_header = 8;
    if (array_compare(version, [3, 7]) >= 0) {
        total_header = 16;
    } else if (array_compare(version, [3, 3]) >= 0) {
        total_header = 12;
    }
    let toc_offset = reader.readInt();
    reader_le.seek(toc_offset);
    let toc = marshal_loads(reader_le, version);
    let toc_js = {};
    if (toc.type === "list") {
        // 3.1+: list of tuples
        toc.children.forEach(child => {
            // tuple
            console.assert(child.type === "tuple");
            let key = child.children[0];
            if (key.type === "bytes") {
                key = String.fromCharCode(...key.type.value);
            } else if (key.type === "str") {
                key = key.str;
            }
            let value = child.children[1];
            console.assert(value.type === "tuple");
            toc_js[key] = {
                "typecode": value.children[0].number,
                "entry_offset": value.children[1].number,
                "entry_length": value.children[2].number,
            }
        })
    } else if (toc.type === "dict") {
        toc.keys.forEach((key, index) => {
            // tuple
            console.assert(child.type === "tuple");
            let value = toc.values[index];
            if (key.type === "bytes") {
                key = String.fromCharCode(...key.type.value);
            } else if (key.type === "str") {
                key = key.str;
            }
            console.assert(value.type === "tuple");
            toc_js[key] = {
                "typecode": value.children[0].number,
                "entry_offset": value.children[1].number,
                "entry_length": value.children[2].number,
            }
        })
    }
    lines.push("==============================");
    lines.push("Table of Contents:");

    var cipher = encryption_key === null ? null : aes128(encryption_key);
    for (const key in toc_js) {
        console.log(toc_js[key]);
        let { typecode, entry_offset, entry_length } = toc_js[key];
        let data = bytes.slice(entry_offset, entry_offset + entry_length);
        let encrypted = false;
        let data2 = data;
        if (cipher !== null && data.length >= 16) {
            console.log(data);
            data2 = ctr(cipher, data.slice(0, 16), data.slice(16));
            console.log(data2);
        }
        let data3 = await deflate_decompress(data2);
        if (data3.length > 0) {
            data = data3;
        } else {
            encrypted = true;
        }
        if (!encrypted) {
            var new_value = new Uint8Array(total_header + data.length);
            new_value.set(magic_header, 0);
            new_value.set(data, total_header);
            data = new_value;
        }
        children.push({
            "type": "file",
            "label": key + (encrypted ? "_encrypted" : ""),
            "value": data,
            "children": [],
            "show_hex": encrypted,
            "content": [
                "Type: " + _type_codes_pyz[typecode],
                (encrypted ? "Failed to decrypt." : (key === null ? "Not Encrypted." : "Successfully decrypted.")),
            ],
            "loaded": encrypted
        });
        lines.push(`${_type_codes_pyz[typecode]} ${key} (Size: ${data.length.toLocaleString("en")} Bytes, Packed Size: ${entry_length.toLocaleString("en")} Bytes (${encrypted || cipher !== null ? "Encrypted" : "Not Encrypted"})`);
    }
    return children;
}

async function deflate_decompress(data) {
    var return_data;
    try {
        const ds = new DecompressionStream("deflate");
        const blob_in = new Blob([data]);
        const stream_in = blob_in.stream().pipeThrough(ds);
        const blob_out = await new Response(stream_in).blob();
        var return_data = new Uint8Array(await blob_out.arrayBuffer());
    } catch (e) {
        return_data = new Uint8Array([]);
    }
    return return_data;
}

function aes128(key) {
    var xt=a=>(a*2)^((a>>7)*283); var i,j=[1,3],k; for(i=3;i-1;)j.push(i^=xt(i)); var sb=new Array(256).fill(99);
    for(i=0,x=1;i<255;x=j[255-i])sb[j[i++]]=((x|=x<<8)^(k=(x>>4)^(x>>5))^(k>>2)^99)&255;
    var rc=j.map((_,x)=>2**x%229); var ex=new Uint8Array(176); ex.set(key);
    for(i=16;i<176;i+=4)if(i&15)for(j=0;j<4;++j)ex[i|j]=ex[i+j-16]^ex[i+j-4];else for(j=0;j<4;++j)ex[i|j]=ex[i+j-16]^sb[(ex[i+(j+1)%4-4])]^(rc[i/16-1]*!j);
    var addKey=(s,r)=>{for(i=0;i<16;++i)s[i]^=ex[r*16+i]};
    var subShift=s=>([0,1,2,3].forEach(i=>[s[i],s[i|4],s[i|8],s[i|12]]=[0,4,8,12].map(j=>sb[s[i|(i*4+j)&15]])),s);
    var mixCol=s=>([0,4,8,12].forEach(i=>(t=>[s[i],s[i|1],s[i|2],s[i|3]]=[0,1,2,3].map(j=>s[i|j]^t^xt(s[i|j]^s[i|((j+1)&3)])))(s[i]^s[i|1]^s[i|2]^s[i|3])),s);
    return b=>{var s=b.slice(); addKey(s,0); for(var i=1;i<10;)addKey(mixCol(subShift(s)),i++); addKey(subShift(s),i); return s};
}

function ctr(cipher, iv, data) {
    var iv_copy = new Uint8Array(iv);
    var length = data.length;
    var output = new Uint8Array(length);
    for (var i = 0; i < length; i += 16) {
        var temp = cipher(iv_copy);
        for (var j = 0; j < 16; ++j) if (i + j < length) output[i + j] = data[i + j] ^ temp[j];
        for (var j = 15; j >= 0; --j) {
            if (iv_copy[j] === 255) {
                iv_copy[j] = 0;
                continue;
            };
            ++iv_copy[j];
            break;
        };
    }
    return output;
}