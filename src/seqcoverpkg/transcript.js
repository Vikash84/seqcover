"use strict";

function binary_search(A, v) {
    var result = 0;
    var j = A.length
    while (j != 0) {
        let step = j >> 1
        let pos = result + step;
        if (A[pos] < v) {
            result = pos + 1
            j -= step + 1
        } else {
            j = step
        }

    }
    return result
}

// enum
const FeatureType = Object.freeze({
    EXON: "exon",
    CDS: "CDS",
    UTR: "UTR",
    TRANSCRIPT: "transcript"
})

const aesthetics = {
    TRANSCRIPT_COLOR: "rgba(65, 65, 65, 0.6)",
    TRANSCRIPT_WIDTH: 4,
    EXON_COLOR: "rgba(105,105,105, 0.6)",
    EXON_WIDTH: 19,
    CDS_COLOR: 'rgb(195, 155, 155)',
    CDS_WIDTH: 12,
}

class Feature {
    constructor(start, stop, type, transcript) {
        this.start = start
        this.stop = stop
        this.type = type
        this.transcript = transcript
    }
    get coding() {
        return this.type == FeatureType.CDS
    }


    hoverinfo(xs, gs) {
        // xs is plot coordinates, gs is genome coordinates
        // get genomic coordinate by finding index of plot-coord
        // and then looking it up in genomic array
        var start = gs[binary_search(xs, this.start)]
        var stop = gs[binary_search(xs, this.stop)]
        return {
            "transcript": this.transcript.data.transcript,
            "strand": this.transcript.strand,
            "start": start,
            "stop": stop,
            "type": this.type.toString()
        }
    }
}

class Transcript {
    constructor(data) {
        this.data = data
    }
    get cdsstart() {
        return this.data.cdsstart
    }
    get cdsend() {
        return this.data.cdsend
    }
    get chr() {
        return this.data.chr
    }

    get exons() {
        return this.data.position
    }

    get position() {
        return this.data.position
    }
    get strand() {
        return this.data.strand == -1 ? "-" : "+"
    }

    get name() {
        return this.data.transcript
    }

    get txstart() {
        return this.data.txstart
    }
    get txend() {
        return this.data.txend
    }

    parts() {
        // return CDS,exon,UTR in an array. exon and CDS are potentially
        // (often) duplicated.
        var that = this
        var result = []
        result.push(new Feature(this.data.txstart, this.data.cdsstart, FeatureType.UTR, that))
        this.data.position.forEach((exon, i) => {
            result.push(new Feature(exon[0], exon[1], FeatureType.EXON, that))
            if (exon[1] < this.data.cdsstart || exon[0] > this.data.cdsend) {
                // continue
            } else {
                result.push(new Feature(Math.max(this.data.cdsstart, exon[0]), Math.min(this.data.cdsend, exon[1]), FeatureType.CDS, that))
            }

        })
        result.push(new Feature(this.data.cdsend, this.data.txend, FeatureType.UTR, that))
        return result.filter(f => f.stop - f.start > 0)

    }

    overlaps(position) {
        // return parts() that overlap with this position
        let that = this
        var result = []
        if (position < this.txstart || position > this.txend) { return result }
        if (position < this.cdsstart) { result.push(new Feature(this.data.txstart, this.data.cdsstart, FeatureType.UTR, that)) }
        this.data.position.forEach((exon, i) => {
            if (exon[0] > position || exon[1] < position) {
                return
            }
            result.push(new Feature(exon[0], exon[1], FeatureType.EXON, that))
            if (exon[1] < that.data.cdsstart || exon[0] > that.data.cdsend) {
                // continue
            } else {
                var f = new Feature(Math.max(this.data.cdsstart, exon[0]), Math.min(this.data.cdsend, exon[1]), FeatureType.CDS, that)
                if (f.stop - f.start > 0) {
                    result.push(f)
                }
            }
        })
        if (position >= this.cdsend) {
            result.push(new Feature(this.data.cdsend, this.data.txend, FeatureType.UTR, that))
        }
        return result;
    }

    traces(y_offset, xs, gs) {

        function get_genomic_coord(x) {
            return isNaN(x) ? NaN : gs[binary_search(xs, x)]
        }

        var transcript_trace = {
            name: this.data.transcript, x: [this.data.txstart, this.data.txend], y: [y_offset, y_offset],
            type: "scatter", mode: "lines", showlegend: false,
            hoverinfo: "none",
            line: { color: aesthetics.TRANSCRIPT_COLOR, width: aesthetics.TRANSCRIPT_WIDTH }
        }

        let parts = this.parts()

        var exon_trace = {
            name: this.data.transcript + " exons", x: [], y: [], text:[],
            type: "scatter", mode: "lines", showlegend: false,
            hoverinfo: "text",
            line: { color: aesthetics.EXON_COLOR, width: aesthetics.EXON_WIDTH }
        }
        let exons = parts.filter(p => p.type == FeatureType.EXON)
        exons.forEach((e, i) => {
            if ((exon_trace.x.length) > 0) {
                exon_trace.x.push(NaN)
                exon_trace.y.push(y_offset)
                exon_trace.text.push(undefined)
            }
            var iex = this.data.strand == -1 ? (exons.length - i) : (i + 1)

            let txt = `exon ${iex} / ${exons.length}`;
            exon_trace.text.push(txt, txt)
            exon_trace.x.push(e.start, e.stop)
            exon_trace.y.push(y_offset, y_offset)
        })

        var cds_trace = {
            name: this.data.transcript + " CDS", x: [], y: [], text:[],
            type: "scatter", mode: "lines", showlegend: false,
            hoverinfo: "text",
            hovermode:"closest-x",
            line: { color: aesthetics.CDS_COLOR, width: aesthetics.CDS_WIDTH }
        }
        parts.filter(p => p.type == FeatureType.CDS).forEach(c => {
            if ((cds_trace.x.length) > 0) {
                cds_trace.x.push(NaN)
                cds_trace.y.push(y_offset)
                cds_trace.text.push(undefined)
            }
            // index back into exon array even for CDS hover
            var ei = 0
            for(var e of exons) {
                ei += 1
                if(e.start <= c.start && e.stop >= c.stop) {
                    break;
                }
            }

            var iex = this.data.strand == -1 ? (exons.length - ei + 1) : (ei + 1)
            let txt = `exon ${iex} / ${exons.length} (CDS)`
            cds_trace.text.push(txt, txt)
            cds_trace.x.push(c.start, c.stop)
            cds_trace.y.push(y_offset, y_offset)
        })

        var result = [transcript_trace, exon_trace, cds_trace]
        result.forEach(trace => {
            trace.genome_x = trace.x.map(x => get_genomic_coord(x))
        })
        return result

    }

    stats(xranges, depths, background_depths, low_depth_cutoff) {
        // NOTE xranges is in reduced, plot coords, not genomic coords and it
        // has form [{start: 23, stop: 44}, ...]
        var result = {}
        var background_low;
        // handle missing or undefined backgrounds
        if (background_depths != undefined && background_depths != {} && background_depths != []) {
            // background depths might hvae string keys like p5, p95. so we sort to
            // get the lowest value.
            var lo_key = Object.keys(background_depths).sort((a, b) => {
                return parseInt(a.replace(/^\D+/g, "")) - parseInt(b.replace(/^\D+/g, ""))
            })[0]
            background_low = background_depths[lo_key] //.slice(xstart, xstop)
        }
        var H = Array(16384);
        for (var sample in depths) {
            var S = 0; var N = 0; var lo = 0; var bg_lo = 0;
            H.fill(0);
            var dps = depths[sample];

            for (var rng of xranges) {
                for (var i = rng.start; i < rng.stop; i++) {
                    let d = dps[i]
                    if (d < 0 || isNaN(d)) { continue; }
                    lo += (d < low_depth_cutoff);
                    if (background_low != undefined) {
                        bg_lo += d < background_low[i];
                    }
                    H[Math.min(d, H.length - 1)] += 1;
                    S += d;
                    N += 1
                }
            }
            result[sample] = { "low": lo, "lt-background": bg_lo }
            var mid = N * 0.5; // 50% of data below this number of samples.
            var j = 0
            var nc = H[j]
            while (nc < mid) {
                j += 1
                nc += H[j]
            }
            result[sample]["mean"] = S / N
            result[sample]["median"] = j
        }
        return result;
    }
}

function z_transform(data) {
    // TODO: use 1-pass for mean, sd
    var s = 0
    for(let d of data) s += d;
    let mean = s / data.length;

    var sd = 0;
    for(let d of data) { sd += Math.pow(d - mean, 2); }
    sd = Math.sqrt(sd / data.length);

    return data.map(d => (d - mean) / sd)
}

try {
    // node.js stuff to allow testing
    exports.Transcript = Transcript
    exports.FeatureType = FeatureType
    exports.z_transform = z_transform


    if (require.main === module) {
        // xs and gs data for testing.
        let data = require("./test/data.js")
        let tr = new Transcript(data.tr_data)

        tr.parts().forEach(p => console.log(p.hoverinfo(data.xs, data.gs)))

        console.log(tr.traces(0))

    }
} catch (e) {
    // browser
}
