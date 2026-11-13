declare const nacl: { sign: { detached: { verify(msg: Uint8Array, sig: Uint8Array, pk: Uint8Array): boolean } } };
export default nacl;
