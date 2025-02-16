function handleBytes_pyc(bytes, lines, version_override=null) {
    // version_override: array of integer
    var children = [];
    var reader = new LittleEndianReader(bytes);
    let magic = reader.readInt();
    console.assert((magic & 0xffff0000) === 0x0a0d0000); // ?? ?? \r \n
    let version;
    if (version_override === null) {
        lines.push(`Magic Number: ${magic >>> 0} (0x${(magic >>> 0).toString(16).padStart(8, "0")})`); // unsigned
        version = get_python_version(magic & 0x0000ffff);
    } else {
        version = version_override;
    }
    lines.push(`Python Magic Number: ${magic & 0x0000ffff} (${version.join(".")})`);
    if (array_compare(version, [3, 7]) >= 0) { // PEP 552
        let bitfield = reader.readInt();
        lines.push(`Bit Field: ${bitfield}`);
    }
    let modificationDate = reader.readInt();
    lines.push(`Modification Date: ${modificationDate} (${dateString(modificationDate * 1000)})`);
    if (array_compare(version, [3, 3]) >= 0) { // PEP 3147
        let filesize = reader.readInt();
        lines.push(`File Size: ${filesize}`);
    }
    let pyobject = marshal_loads(reader, version);
    if (pyobject.type == "code") {
        children.push(pyobject);
    } else {
        children.push({"label": "Not a Module", "content": "Not a Module"});
    }
    lines.push(`==============================`);
    if (reader.eof()) {
        lines.push(`No Leftover Data`);
    } else {
        lines.push(`Leftover Data:`);
        show_hex(reader.read()).forEach(line => lines.push(line));
    }
    return children;
}
