/**
 * ID3 Tag Parser (Pure JavaScript - ID3v1 & ID3v2.3 / ID3v2.4)
 * Extracts Title, Artist, Album, Year, and embedded Album Art (APIC).
 */
class ID3Parser {
    static async parse(file) {
        const metadata = {
            title: file.name.replace(/\.[^/.]+$/, ''),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            year: '',
            genre: '',
            coverArt: null
        };

        // Heuristic fallback from filename: "Artist - Title" or "01 - Artist - Title"
        const cleanName = metadata.title.replace(/^\d+[\s.-]+/, '');
        if (cleanName.includes(' - ')) {
            const parts = cleanName.split(' - ');
            metadata.artist = parts[0].trim();
            metadata.title = parts.slice(1).join(' - ').trim();
        }

        try {
            // Read first 256KB for ID3v2
            const headerBuffer = await this.readSlice(file, 0, Math.min(262144, file.size));
            const id3v2Data = this.parseID3v2(headerBuffer);
            if (id3v2Data) {
                if (id3v2Data.title) metadata.title = id3v2Data.title;
                if (id3v2Data.artist) metadata.artist = id3v2Data.artist;
                if (id3v2Data.album) metadata.album = id3v2Data.album;
                if (id3v2Data.year) metadata.year = id3v2Data.year;
                if (id3v2Data.coverArt) metadata.coverArt = id3v2Data.coverArt;
                return metadata;
            }

            // Fallback to ID3v1 (last 128 bytes)
            if (file.size > 128) {
                const tailBuffer = await this.readSlice(file, file.size - 128, file.size);
                const id3v1Data = this.parseID3v1(tailBuffer);
                if (id3v1Data) {
                    if (id3v1Data.title) metadata.title = id3v1Data.title;
                    if (id3v1Data.artist) metadata.artist = id3v1Data.artist;
                    if (id3v1Data.album) metadata.album = id3v1Data.album;
                    if (id3v1Data.year) metadata.year = id3v1Data.year;
                }
            }
        } catch (e) {
            console.warn("Błąd parsowania tagów ID3:", e);
        }

        return metadata;
    }

    static readSlice(file, start, end) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            const slice = file.slice(start, end);
            reader.readAsArrayBuffer(slice);
        });
    }

    static decodeString(bytes, encoding = 0) {
        try {
            if (encoding === 1 || encoding === 2) {
                // UTF-16
                return new TextDecoder('utf-16').decode(bytes).replace(/\0+$/, '').trim();
            } else if (encoding === 3) {
                // UTF-8
                return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '').trim();
            } else {
                // ISO-8859-1 / Windows-1250 / Latin1
                return new TextDecoder('iso-8859-1').decode(bytes).replace(/\0+$/, '').trim();
            }
        } catch {
            return '';
        }
    }

    static parseID3v2(buffer) {
        const view = new DataView(buffer);
        if (view.byteLength < 10) return null;

        // Magic bytes "ID3"
        if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
            return null;
        }

        const versionMajor = view.getUint8(3); // 3 for 2.3.0, 4 for 2.4.0
        const flags = view.getUint8(5);
        
        // Syncsafe integer for tag size
        const tagSize = (
            ((view.getUint8(6) & 0x7F) << 21) |
            ((view.getUint8(7) & 0x7F) << 14) |
            ((view.getUint8(8) & 0x7F) << 7) |
            (view.getUint8(9) & 0x7F)
        );

        let offset = 10;
        // Check for extended header
        if ((flags & 0x40) !== 0) {
            const extSize = (
                ((view.getUint8(10) & 0x7F) << 21) |
                ((view.getUint8(11) & 0x7F) << 14) |
                ((view.getUint8(12) & 0x7F) << 7) |
                (view.getUint8(13) & 0x7F)
            );
            offset += extSize;
        }

        const result = {};
        const maxOffset = Math.min(offset + tagSize, view.byteLength);

        while (offset + 10 < maxOffset) {
            // Read Frame ID (4 bytes)
            let frameId = '';
            for (let i = 0; i < 4; i++) {
                const charCode = view.getUint8(offset + i);
                if (charCode === 0) break;
                frameId += String.fromCharCode(charCode);
            }

            if (frameId.length < 4 || !/^[A-Z0-9]{4}$/.test(frameId)) {
                break;
            }

            let frameSize = 0;
            if (versionMajor === 4) {
                // ID3v2.4 synchsafe frame size
                frameSize = (
                    ((view.getUint8(offset + 4) & 0x7F) << 21) |
                    ((view.getUint8(offset + 5) & 0x7F) << 14) |
                    ((view.getUint8(offset + 6) & 0x7F) << 7) |
                    (view.getUint8(offset + 7) & 0x7F)
                );
            } else {
                // ID3v2.3 normal integer frame size
                frameSize = view.getUint32(offset + 4, false);
            }

            offset += 10; // header size
            if (frameSize <= 0 || offset + frameSize > maxOffset) {
                break;
            }

            const frameData = new Uint8Array(buffer, offset, frameSize);

            // Handle Text Frames
            if (['TIT2', 'TPE1', 'TALB', 'TYER', 'TDRC', 'TCON'].includes(frameId)) {
                const encoding = frameData[0];
                const textBytes = frameData.subarray(1);
                const textVal = this.decodeString(textBytes, encoding);
                
                if (frameId === 'TIT2') result.title = textVal;
                if (frameId === 'TPE1') result.artist = textVal;
                if (frameId === 'TALB') result.album = textVal;
                if (frameId === 'TYER' || frameId === 'TDRC') result.year = textVal.substring(0, 4);
            }
            // Handle Album Art (APIC)
            else if (frameId === 'APIC') {
                try {
                    const encoding = frameData[0];
                    let p = 1;
                    
                    // MIME type
                    let mimeType = '';
                    while (p < frameData.length && frameData[p] !== 0) {
                        mimeType += String.fromCharCode(frameData[p]);
                        p++;
                    }
                    p++; // skip null
                    if (!mimeType) mimeType = 'image/jpeg';

                    const picType = frameData[p];
                    p++; // skip picture type

                    // Description
                    if (encoding === 1 || encoding === 2) {
                        while (p < frameData.length - 1 && !(frameData[p] === 0 && frameData[p+1] === 0)) {
                            p += 2;
                        }
                        p += 2;
                    } else {
                        while (p < frameData.length && frameData[p] !== 0) {
                            p++;
                        }
                        p++;
                    }

                    if (p < frameData.length) {
                        const imgData = frameData.subarray(p);
                        const blob = new Blob([imgData], { type: mimeType });
                        result.coverArt = URL.createObjectURL(blob);
                    }
                } catch (e) {
                    console.warn("Błąd parsowania okładki APIC:", e);
                }
            }

            offset += frameSize;
        }

        return result;
    }

    static parseID3v1(buffer) {
        const view = new DataView(buffer);
        if (view.byteLength < 128) return null;

        const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2));
        if (magic !== 'TAG') return null;

        const readStr = (start, length) => {
            let str = '';
            for (let i = 0; i < length; i++) {
                const code = view.getUint8(start + i);
                if (code === 0) break;
                str += String.fromCharCode(code);
            }
            return str.trim();
        };

        return {
            title: readStr(3, 30),
            artist: readStr(33, 30),
            album: readStr(63, 30),
            year: readStr(93, 4)
        };
    }
}
window.ID3Parser = ID3Parser;
