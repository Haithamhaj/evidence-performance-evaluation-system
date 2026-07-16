// thread-stream 4.2 still names the pre-Node-26 alias. Keep strict library
// checking enabled while bridging it to the current worker_threads type.
declare module "worker_threads" {
  type TransferListItem = Transferable;
}
