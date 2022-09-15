import { Location } from 'geolocation-utils'

import { ZoneActivity } from './zone';

import {AISRecord, VesselSighting, MMSI, instanceOfAIS } from './mod'


// export type TrackMarker = {
//   name: string;
//   where: Location;
//   when: Date;
//   zone?: {
//     name: string;
//     activity: ZoneActivity;
//   }
// }

type Vessel = {
  mmsi: MMSI;
  name: string;
}

export class VesselTrack {
  private track: VesselSighting[] = [];
  private active: boolean = true;

  constructor(private mmsi: MMSI) {}

  isActive(): boolean { return this.active }
  end(): void { this.active = false }

  addSighting(sighting: VesselSighting): void {
    // Put it in order by date & time
    const putBefore = this.track.findIndex( t => t.when.getTime() > sighting.when.getTime() );
    if (putBefore >= 0) {
      this.track.splice(putBefore, 0, sighting);
    } else {
      this.track.push(sighting);
    }
  }

  // addMarker(marker: TrackMarker): void {
  //   this.track.push(marker);
  // }

  getMMSI(): MMSI { return this.mmsi }

  getTrack(): VesselSighting[] {
    return this.track;
  }

}

export class VesselTracker {
  private tracks: {[mmsi:MMSI]: VesselTrack[]} = {};
  private mmsilist: {[mmsi:MMSI]: Vessel} = {};

  private activeTrackIndex(mmsi: MMSI): number | undefined {
    const last = this.tracks[mmsi]?.length-1;
    return last >= 0 && this.tracks[mmsi][last].isActive() ? last : undefined
  }

  constructor() {}

  startTracking(mmsi: MMSI) : void {
    if (!this.tracks[mmsi]) {
      this.tracks[mmsi] = [];
    }
    this.tracks[mmsi].push(new VesselTrack(mmsi));
  }

  stopTracking(mmsi: MMSI) : void {
    const idx = this.activeTrackIndex(mmsi);
    if (idx !== undefined) {
      this.tracks[mmsi][idx].end();
    }
  }

  isTracking(mmsi: MMSI): boolean {
    return this.getActiveTrack(mmsi) !== undefined;
  }

  addSighting(sighting: AISRecord): void;
  addSighting(sighting: VesselSighting): void;
  addSighting(sighting: any): void {
    if (instanceOfAIS(sighting) && this.mmsilist[sighting.mmsi] == undefined) {
      const ais: AISRecord = sighting; 
      this.setVesselData(ais);
    }
    const idx = this.activeTrackIndex(sighting.mmsi);
    if (idx !== undefined) {
      this.tracks[sighting.mmsi][idx].addSighting(sighting);
    }
  }

  getAllTracks(mmsi: MMSI): VesselTrack[] {
    return this.tracks[mmsi] || [];
  }

  getActiveTrack(mmsi: MMSI): VesselTrack | undefined {
    const idx = this.activeTrackIndex(mmsi);
    return idx !== undefined ? this.tracks[mmsi][idx] : undefined;
  }

  getVesselData(mmsi: MMSI): Vessel {
    return this.mmsilist[mmsi];
  }

  setVesselData(ais: AISRecord): void {
    this.mmsilist[ais.mmsi] = {
      mmsi: ais.mmsi,
      name: ais.name
    }
  }

}
