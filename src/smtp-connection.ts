import type { CipherNameAndProtocol, Server, TLSSocket, TLSSocketOptions } from 'node:tls'
import type { SMTPStream } from './smtp-stream'
import type { AuthCallback, AuthOptions, AuthResponse } from './types'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes } from 'node:crypto'
import { lookup, reverse } from 'node:dns'
import { EventEmitter } from 'node:events'
import { isIP, isIPv6 } from 'node:net'
import { hostname } from 'node:os'
import base32 from 'base32.js'
import ipv6normalize from 'ipv6-normalize'
import punycode from 'punycode.js'
import { SASL } from './sasl'

const _SOCKET_TIMEOUT = 60 * 1000

interface SMTPServerOptions {
  secure?: boolean
  needsUpgrade?: boolean
  size?: number
  name?: string
  banner?: string
  hideSTARTTLS?: boolean
  hideSize?: boolean
  authMethods: string[]
  disabledCommands: string[]
  authOptional?: boolean
  maxClients?: number
  socketTimeout?: number
  lmtp?: boolean
  useXClient?: boolean
  useXForward?: boolean
  disableReverseLookup?: boolean
  maxAllowedUnauthenticatedCommands?: number
  allowInsecureAuth?: boolean
  SNICallback?: (servername: string, cb: (err: Error | null, ctx?: SecureContext) => void) => void
  secureContext: Map<string, SecureContext>
  logger: Logger
  onAuth: (auth: AuthOptions, session: Session, callback: AuthCallback) => void
  onConnect: (session: Session, callback: (err?: Error) => void) => void
  onSecure: (socket: TLSSocket, session: Session, callback: (err?: Error) => void) => void
  onClose: (session: Session) => void
  onData: (stream: SMTPStream, session: Session, callback: (err?: Error, message?: string | Error[]) => void) => void
  onMailFrom: (address: Address, session: Session, callback: (err?: Error) => void) => void
  onRcptTo: (address: Address, session: Session, callback: (err?: Error) => void) => void
}

interface SMTPConnectionOptions {
  id?: string
  ignore?: boolean
  localAddress?: string
  localPort?: number
  remoteAddress?: string
  remotePort?: number
}

interface Logger {
  info: (data: object, message: string, ...args: any[]) => void
  debug: (data: object, message: string, ...args: any[]) => void
  error: (data: object, message: string, ...args: any[]) => void
}

interface Session {
  id: string
  localAddress?: string
  localPort?: number
  remoteAddress?: string
  remotePort?: number
  clientHostname?: string
  openingCommand?: string
  hostNameAppearsAs?: string
  transmissionType?: string
  tlsOptions?: CipherNameAndProtocol
  user?: any
  envelope: {
    mailFrom: Address | false
    rcptTo: Address[]
  }
  transaction?: number
  secure?: boolean
  servername?: string
  xClient?: Map<string, any>
  xForward?: Map<string, any>
  error?: string
}

interface Address {
  address: string
  args?: Record<string, any>
}

interface SecureContext {
  context: any
}

/**
 * Creates a handler for new socket
 */
export class SMTPConnection extends EventEmitter {
  id: string
  ignore: boolean
  _server: SMTPServerOptions
  _socket: TLSSocket
  session: Session
  name: string
  secure: boolean
  clientHostname: string | false
  hostNameAppearsAs: string | false
  openingCommand: string | false
  _xClient: Map<string, any>
  _xForward: Map<string, any>
  _canEmitConnection: boolean
  _closing: boolean
  _closed: boolean
  _upgrading: boolean
  _ready: boolean
  _parser: SMTPStream
  _dataStream: SMTPStream | false
  _unrecognizedCommands: number
  _unauthenticatedCommands: number
  _maxAllowedUnauthenticatedCommands: number | false
  _transactionCounter: number
  localAddress: string
  localPort: number
  remoteAddress: string
  remotePort: number
  needsUpgrade: boolean
  tlsOptions: false | CipherNameAndProtocol

  constructor(server: SMTPServerOptions, socket: TLSSocket, options: SMTPConnectionOptions = {}) {
    super()

    // Random session ID, used for logging
    this.id = options.id || base32.encode(randomBytes(10)).toLowerCase()

    this.ignore = options.ignore || false

    this._server = server
    this._socket = socket

    // session data (envelope, user etc.)
    this.session = {
      id: this.id,
      envelope: {
        mailFrom: false,
        rcptTo: [],
      },
    }

    // how many messages have been processed
    this._transactionCounter = 0

    // Do not allow input from client until initial greeting has been sent
    this._ready = false

    // If true then the connection is currently being upgraded to TLS
    this._upgrading = false

    // Set handler for incoming command and handler bypass detection by command name
    this._parser = new SMTPStream()

    // Set handler for incoming commands
    this._parser.oncommand = (command: string, callback: () => void) => this._onCommand(command, callback)

    // if currently in data mode, this stream gets the content of incoming message
    this._dataStream = false

    // If true, then the connection is using TLS
    this.session.secure = this.secure = !!this._server.secure

    this.needsUpgrade = !!this._server.needsUpgrade

    this.tlsOptions = this.secure && !this.needsUpgrade && this._socket.getCipher ? this._socket.getCipher() : false

    // Store local and remote addresses for later usage
    this.localAddress = (options.localAddress || this._socket.localAddress || '').replace(/^::ffff:/, '')
    this.localPort = Number(options.localPort || this._socket.localPort) || 0
    this.remoteAddress = (options.remoteAddress || this._socket.remoteAddress || '').replace(/^::ffff:/, '')
    this.remotePort = Number(options.remotePort || this._socket.remotePort) || 0

    // normalize IPv6 addresses
    if (this.localAddress && isIPv6(this.localAddress)) {
      this.localAddress = ipv6normalize(this.localAddress)
    }
    if (this.remoteAddress && isIPv6(this.remoteAddress)) {
      this.remoteAddress = ipv6normalize(this.remoteAddress)
    }

    // Error counter - if too many commands in non-authenticated state are used, then disconnect
    this._unauthenticatedCommands = 0

    // Max allowed unauthenticated commands
    this._maxAllowedUnauthenticatedCommands = this._server.maxAllowedUnauthenticatedCommands || 10

    // Error counter - if too many invalid commands are used, then disconnect
    this._unrecognizedCommands = 0

    // Server hostname for the greetings
    this.name = this._server.name || hostname()

    // Resolved hostname for remote IP address
    this.clientHostname = false

    // The opening SMTP command (HELO, EHLO or LHLO)
    this.openingCommand = false

    // The hostname client identifies itself with
    this.hostNameAppearsAs = false

    // data passed from XCLIENT command
    this._xClient = new Map()

    // data passed from XFORWARD command
    this._xForward = new Map()

    // if true then can emit connection info
    this._canEmitConnection = true

    // increment connection count
    this._closing = false
    this._closed = false
  }

  // ... rest of the class methods ...
  // I'll continue with the methods in subsequent edits

  protected _onCommand(_command: string, _callback: () => void): void {
    // Implementation will be added in next edit
  }
}
