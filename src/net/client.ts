import type { Mode } from '../sim/modes';
import type { Input } from '../sim/snake';
import type { StageId } from '../sim/stage';
import { stageFor } from '../sim/stages';
import { type ClientMessage, PROTOCOL, type ServerMessage } from './protocol';
import { Replica } from './replica';

export type Outfit = { skin: string; hat: string; trail: string; name: string };
export type Sorry = Extract<ServerMessage, { t: 'sorry' }>['why'] | 'offline';

const CONNECT_TIMEOUT = 2500; // a child is waiting on the Play button: give up quickly and play offline

/** In development the game comes from Vite and the server runs beside it; once built, the server serves both. */
function serverUrl(): string {
  const custom = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (custom) return custom;
  const secure = location.protocol === 'https:';
  const host = import.meta.env.DEV ? `${location.hostname}:8787` : location.host;
  return `${secure ? 'wss' : 'ws'}://${host}/play`;
}

/** A seat in a shared playground: the socket, and this phone's live copy of the world. */
export class Connection {
  /** Set once the seat is given up, by either side, so losing the line is only reported once. */
  private over = false;

  private constructor(private readonly socket: WebSocket, readonly replica: Replica) {}

  /** Resolves once seated. Rejects with a short reason a screen can show as a picture. */
  static join(outfit: Outfit, mode: Mode, canBuy: boolean, stage: StageId, onLost: () => void): Promise<Connection> {
    return new Promise((resolve, reject) => {
      let socket: WebSocket;
      try {
        socket = new WebSocket(serverUrl());
      } catch {
        reject('offline' satisfies Sorry);
        return;
      }
      let connection: Connection | null = null;
      // Once we have given up and gone offline, a reply that turns up late must be ignored:
      // otherwise it would build a connection nobody holds, whose closing ends the offline game.
      let gaveUp = false;
      const send = (m: ClientMessage) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m));
      };
      const timer = window.setTimeout(() => {
        if (connection) return;
        gaveUp = true;
        socket.close();
        reject('offline' satisfies Sorry);
      }, CONNECT_TIMEOUT);

      socket.addEventListener('open', () => send({ t: 'hello', v: PROTOCOL, mode, stage, buy: canBuy ? 1 : 0, ...outfit }));
      socket.addEventListener('message', (e) => {
        if (gaveUp) return;
        let m: ServerMessage;
        try {
          m = JSON.parse(String(e.data)) as ServerMessage;
        } catch {
          return;
        }
        if (m.t === 'welcome') {
          window.clearTimeout(timer);
          // Thumb state goes up at 30 Hz: every other tick is plenty.
          const replica = new Replica(m, stageFor(m.stage), (q: number, i: Input) => {
            if (q % 2 === 0) send({ t: 'in', q, x: i.x, z: i.z, a: i.active ? 1 : 0, d: i.dash ? 1 : 0 });
          });
          connection = new Connection(socket, replica);
          resolve(connection);
        } else if (m.t === 'sorry') {
          window.clearTimeout(timer);
          socket.close();
          reject(m.why);
        } else if (m.t === 'seats') connection?.replica.setSeats(m.seats);
        else if (m.t === 'snap') connection?.replica.receive(m);
      });
      const lost = () => {
        window.clearTimeout(timer);
        if (gaveUp) return;
        if (!connection) reject('offline' satisfies Sorry);
        else if (!connection.over) {
          connection.over = true;
          onLost();
        }
      };
      socket.addEventListener('close', lost);
      socket.addEventListener('error', lost);
    });
  }

  private send(message: ClientMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  pick(index: number): void {
    this.send({ t: 'pick', i: index });
  }

  /** In a menu: the server stands my snake aside, frozen and safe, for a little while. */
  away(on: boolean): void {
    this.replica.paused = on;
    this.send({ t: 'away', on: on ? 1 : 0 });
  }

  /** Changed clothes mid-game: everyone in the room sees it. */
  wear(outfit: Outfit): void {
    this.send({ t: 'look', ...outfit });
  }

  /** Tell the server whether I now have a gem to spend, so it knows whether to offer power cards. */
  setCanBuy(on: boolean): void {
    this.send({ t: 'gems', on: on ? 1 : 0 });
  }

  /** The line has gone quiet: close it and let the usual "connection lost" path run. */
  drop(): void {
    this.socket.close();
  }

  leave(): void {
    this.over = true;
    this.socket.close();
  }
}
