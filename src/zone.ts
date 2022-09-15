import {insidePolygon, insideCircle, toLonLatTuple, LonLatTuple } from 'geolocation-utils'
import { VesselSighting, MMSI } from './mod'


type ZoneUserFunction = (sighting: VesselSighting, zone: Zone, event: ZoneActivity) => void;

export enum ZoneActivity { Entered, Exited, Within }

export abstract class Zone {
  private vesselsInZone: {
    [mmsi:MMSI]: {
      count: number;
      firstSighting: Date;
    }
  } = {};

  constructor(public id: string, private userFunction: ZoneUserFunction) {}

  getVesselsWithin(): MMSI[] {
    return Object.keys(this.vesselsInZone).map( k => Number(k) );
  }

  containsVessel(mmsi: number): boolean {
    return this.vesselsInZone[mmsi] !== undefined;
  }

  addSighting(sighting: VesselSighting): void {
    if (this.locationInZone(toLonLatTuple(sighting.where))) {
      if (this.containsVessel(sighting.mmsi)) {
        // Still in zone
        this.vesselsInZone[sighting.mmsi].count++;
        if (sighting.when.getTime() < this.vesselsInZone[sighting.mmsi].firstSighting.getTime()) {
          // Still in zone, but earlier than previously known
          this.vesselsInZone[sighting.mmsi].firstSighting = sighting.when;
        } else {
          // Still in zone, this time is later than previously known
          this.userFunction(sighting, this, ZoneActivity.Within);
        }
      } else {
        // Entered zone
        this.vesselsInZone[sighting.mmsi] = { 
          count: 1,
          firstSighting: sighting.when
        };
        this.userFunction(sighting, this, ZoneActivity.Entered);
      }
    } else if (this.containsVessel(sighting.mmsi)) {
      // Outside of zone that it is currently thought to be in, but was it really an exit?
      if (sighting.when.getTime() < this.vesselsInZone[sighting.mmsi].firstSighting.getTime()) {
        // No, this happened before the sighting that it was in the zone
      } else {
        // Exited zone
        delete this.vesselsInZone[sighting.mmsi];
        this.userFunction(sighting, this, ZoneActivity.Exited);
      }
    } else {
      // Isn't in zone now and didn't exit it, ignore the sighting
    }
  }

  abstract locationInZone(loc: LonLatTuple): boolean;

}

export class PolygonZone extends Zone {

  constructor (name: string, private polygon: LonLatTuple[], fn: ZoneUserFunction) {
    super(name, fn);
  }

  locationInZone(loc: LonLatTuple): boolean {
    return insidePolygon(loc, this.polygon);
  }

}

type Meters = number;

export class RadialZone<ZoneItemType> extends Zone {
  constructor(name: string, private center: LonLatTuple, private radius: Meters, fn: ZoneUserFunction) {
    super(name, fn);
  }

  locationInZone(loc: LonLatTuple): boolean {
    return insideCircle(loc, this.center, this.radius);
  }

}
