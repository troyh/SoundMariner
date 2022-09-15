import { VesselSighting, MMSI } from './mod'
import { distanceTo, toLonLatTuple } from 'geolocation-utils'

import { Zone, ZoneActivity, PolygonZone } from './zone'
import { VesselTrack, VesselTracker } from './tracker'
import { Watcher } from './watcher'

/*
https://marinecadastre.gov/ais/
AIS Archives: https://coast.noaa.gov/htdata/CMSP/AISDataHandler/2022/index.html
*/

let myTracker = new VesselTracker();
let watcher = new Watcher(myTracker);

function zonesInPath(track: VesselSighting[]): string[] {
  let answer: string[] = [];
  return track
  .map( t => watcher.getZones().find( z => z.locationInZone(toLonLatTuple(t.where)) )?.id )
  .reduce( (p,c) => { 
    if (c != undefined) {
      p.push(c)
    }
    return p; 
  }, answer );
}

function zoneCountsInPath(track: VesselSighting[]): {[zoneid:string]: number} {
  let zoneCounts: {[zoneid:string]: number} = {};
  return zonesInPath(track).reduce( (p, zoneid) => {
    if (p[zoneid] == undefined) { p[zoneid] = 0 }
    p[zoneid]++;
    return p;
  }, zoneCounts );
}

function myZoneFunction(sighting: VesselSighting, zone: Zone, event: ZoneActivity) {
  switch (event) {
    case ZoneActivity.Entered:
      
      if (!myTracker.isTracking(sighting.mmsi)) {
        myTracker.startTracking(sighting.mmsi);
      }

      break;
    case ZoneActivity.Exited:

      // console.log(`${sighting.when.toLocaleDateString()} ${sighting.when.toLocaleTimeString()}: ${sighting.mmsi} <- ${zone.name}`);
      // If the track went through all the zones, stop tracking it
      const activeTrack = myTracker.getActiveTrack(sighting.mmsi);
      if (activeTrack == undefined) { throw new Error('IMPOSSIBLE!')}
      if (Object.values(zoneCountsInPath(activeTrack.getTrack())).filter(n=>n>0).length == watcher.getZones().length) {
        myTracker.stopTracking(sighting.mmsi);
        recordLocking(activeTrack);
      }

      break;
    case ZoneActivity.Within:
      // console.log(`${sighting.when.toLocaleDateString()} ${sighting.when.toLocaleTimeString()}: ${sighting.mmsi}    ${zone.name}`);
      break;
  }
}

watcher.addZone(new PolygonZone(
  'ballardlocks-westside',
  [
    toLonLatTuple({lon: -122.39871948689762, lat: 47.666568170625105}),
    toLonLatTuple({lon: -122.40395515877366, lat: 47.66893078039655}),
    toLonLatTuple({lon: -122.40669101184335, lat: 47.66645979148097}),
    toLonLatTuple({lon: -122.3992881153018, lat: 47.66507974383789}),
  ],
  myZoneFunction
));

watcher.addZone(new PolygonZone(
  'ballardlocks-eastside',
  [
    toLonLatTuple({lon: -122.39486783467007, lat: 47.66571558181046 }),
    toLonLatTuple({lon: -122.3964117550044, lat: 47.66460344039013 }),
    toLonLatTuple({lon: -122.38836829119701, lat: 47.663332277477885 }),
    toLonLatTuple({lon: -122.38786403592535, lat: 47.66487133266595 }),
  ],
  myZoneFunction
));

function sortByFrom(a: Locking, b: Locking) : number {
  return a.from.when.getTime() - b.from.when.getTime();
}

function showCurrentState() : void {

  // List all the lockings
  for (let locking of lockings.sort( sortByFrom )) {
    console.log(`${locking.from.when.toLocaleTimeString()}: ${locking.direction == 'east'?'->':'<-'} ${Math.round((locking.to.when.getTime()-locking.from.when.getTime())/1000/60)} minutes ${myTracker.getVesselData(locking.mmsi).name} [${locking.to.when.toLocaleTimeString()}]`);
  }

  // List all the vessels still in each zone
  for (let zone of watcher.getZones()) {
    let mmsilist = zone.getVesselsWithin().filter( mmsi => myTracker.getActiveTrack(mmsi) );
    console.log(`${zone.id} (${mmsilist.length}):`);
    
    for (let mmsi of mmsilist) {
      const vessel = myTracker.getVesselData(mmsi);
      const track = myTracker.getActiveTrack(mmsi)?.getTrack();
      
      if (track == undefined) { throw new Error('Impossible!') }

      console.log(`${vessel.name}: ${track[0].when.toLocaleTimeString()}-${track[track.length-1].when.toLocaleTimeString()} ${Math.round(track.length ? (distanceTo(track[0].where, track[track.length-1].where))/1000/((track[track.length-1].when.getTime()-track[0].when.getTime())/1000/60/60) : 0)}km/h`);
      // console.log(JSON.stringify(track));
    }
  }
  console.log('------------------------------------');
}

const intervalID = setInterval(showCurrentState,10000);

watcher.go()
.catch( (reason: Error) => {
  console.log(reason.message);
  clearInterval(intervalID);
  showCurrentState(); // One last time
} )
.catch( (x: any ) => {
  console.log('This should not happen');
  clearInterval(intervalID);
} );




type Locking = {
  mmsi: MMSI,
  from: VesselSighting,
  to: VesselSighting,
  direction: 'west' | 'east'
};
let lockings: Locking[] = [];

function recordLocking(track: VesselTrack) : void {

  const t = track.getTrack();
  const traversedZones = [...new Set(zonesInPath(t))];

  lockings.push({
    mmsi: track.getMMSI(),
    from: t.find( ti => watcher.getZone(traversedZones[0]).locationInZone(toLonLatTuple(ti.where)) ) || t[0],
    to:   t.find( ti => watcher.getZone(traversedZones[1]).locationInZone(toLonLatTuple(ti.where)) ) || t[0],
    direction: traversedZones[0] == 'ballardlocks-eastside' ? 'west' : 'east'
  });

}

