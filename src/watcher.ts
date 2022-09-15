import {AISRecord, CSVSource, VesselSighting } from './mod'
import { Zone } from './zone'
import { VesselTracker } from './tracker'

type ListenFunction = (sighting: VesselSighting, zone: Zone ) => void;

export class Watcher {

  private zones: { [id:string]: Zone } = {};
  private listeners: {
    [event: string]: ListenFunction[]
  } = {};

  constructor(private tracker: VesselTracker) {}

  addZone(zone: Zone) : void {
    this.zones[zone.id]=zone;
  }

  getZone(id: string): Zone { return this.zones[id] }
  getZones(): Zone[] { return Object.values(this.zones) }

  async go() {
    let s = new CSVSource('noaa', 'data/sample07.csv');
    // let s = new CSVSource('noaa', 'data/AIS_2022_06_30.csv');

    do {
      let r: AISRecord = await s.getRecord();
      for (let zone of this.getZones()) {
        zone.addSighting(r);
      }
  
      if (this.tracker.isTracking(r.mmsi)) {
        this.tracker.addSighting(r);
      }
    } while (true); // Run forever

    // console.log(this.zones);
  }

}

