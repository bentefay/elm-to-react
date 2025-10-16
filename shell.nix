let
  sources = import ./nix/nix/sources.nix;
  nixpkgs = import sources.nixpkgs {};
  default = import ./nix/default.nix sources.nixpkgs;
in
nixpkgs.mkShell {
  inputsFrom = [
    default
  ];

  shellHook = ''
    export NIX_PATH="nixpkgs=${sources.nixpkgs}"
    alias nix-repl="nix repl '<nixpkgs>'"

    REPO=$(git rev-parse --show-toplevel)
    export PATH="$PATH:$REPO/cli/bin"
  '';
}
