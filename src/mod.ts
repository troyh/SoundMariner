import * as readline from 'node:readline/promises';
import * as fs from 'fs';
import * as csvparse from 'csv-parse';

export type MMSI = number;

export type VesselSighting = {
  mmsi: MMSI;
  when: Date;
  where: {
    lat: number;
    lon: number;
  }
}

export interface AISRecord extends VesselSighting {
  name: string;
}

export function instanceOfAIS(x: any): x is AISRecord {
  return 'name' in x;
}

export interface AISSource {
  getRecord() : Promise<AISRecord | undefined>;
}

export class LineFile {

  private readline;
  private iterator;
  private readLines: string[] = [];
  public isDone: boolean = false;

  constructor(private filename: string) {
    this.readline = readline.createInterface({input:fs.createReadStream(filename)});
    this.iterator = this.readline[Symbol.asyncIterator]();
  }

  async getLine() : Promise<string> {
    return new Promise( ( async (resolve, reject) => { 
      const line = await this.iterator.next();
      this.isDone = line.done ? true : false;
      this.readLines.push(line.value);
      // console.log(line.value);
      if (this.isDone) {
        this.readline.close();
      }
      const retline = this.readLines.shift();
      if (retline == undefined) {
        reject(new Error(`EOF: ${this.filename}`));
      } else {
        resolve(retline);
      }
    } ) );
  }
}

type FormatTable = {
  [formatName: string]: {
    [attribute: string]: number
  }
}

export class CSVSource implements AISSource {

  private formats : FormatTable = {
    "noaa": {
      "mmsi"             : 0,
      "when"             : 1,
      "latitude"         : 2,              
      "longitude"        : 3,
      "SOG"              : 4,              
      "COG"              : 5,
      "Heading"          : 6,          
      "VesselName"       : 7,
      "IMO"              : 8,              
      "CallSign"         : 9,
      "VesselType"       : 10,       
      "Status"           : 11,
      "Length"           : 12,           
      "Width"            : 13,
      "Draft"            : 14,            
      "Cargo"            : 15,
      "TransceiverClass" : 16
    }
  }

  private file: LineFile;
  private columns: string[] = [];

  constructor(private formatName: string, filename: string) {
    this.file = new LineFile(filename);
  }

  getRecord(): Promise<AISRecord> {
    return this.file.getLine()
    .then(this.parseLine)
    .then( (obj) => {
      return {
        mmsi: Number(obj[this.formats[this.formatName].mmsi]),
        name: obj[this.formats[this.formatName].VesselName],
        when: new Date(obj[this.formats[this.formatName].when]),
        where: {
          lat: Number(obj[this.formats[this.formatName].latitude]),
          lon: Number(obj[this.formats[this.formatName].longitude])
        }
      };
    } );
  }

  parseLine(line: string | undefined): Promise<string[]> {
    return new Promise( (resolve, reject) => {
      const data = csvparse.parse(line || '', {
        relax_quotes: true
      }, (err, obj) => {
        if (err) {
          reject(err);
        } else {
          resolve(obj[0]);
        }
      } );
    } );  
  }

}

