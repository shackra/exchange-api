{
  description = "exchange-api development environment with Playwright support";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };

        fhsEnv = pkgs.buildFHSEnv {
          name = "exchange-api-shell";
          targetPkgs =
            pkgs: with pkgs; [
              nodejs_22
              # Playwright runtime dependencies
              stdenv.cc.cc.lib
              glib
              nss
              nspr
              atk
              at-spi2-atk
              cups
              dbus
              libdrm
              gtk3
              pango
              cairo
              libx11
              libxcomposite
              libxdamage
              libxext
              libxfixes
              libxrandr
              libxcb
              libxshmfence
              mesa
              expat
              alsa-lib
              libxkbcommon
              # Firefox-specific dependencies
              libxcursor
              libxi
              libxrender
              libxtst
              libxscrnsaver
              freetype
              fontconfig
              gdk-pixbuf
            ];
          profile = ''
            export npm_config_prefix="$HOME/.npm-global"
            export PATH="$npm_config_prefix/bin:$PATH"
          '';
          runScript = "bash";
        };
      in
      {
        # Enter with: nix run .#fhs
        # This launches a FHS chroot environment where Playwright browsers work.
        packages.fhs = fhsEnv;
        packages.default = fhsEnv;

        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.typescript-language-server
            fhsEnv
          ];
          shellHook = ''
            echo "exchange-api development environment"
            echo ""
            echo "NOTE: To run Playwright (needed by currscript.js), enter the FHS"
            echo "environment first by running: exchange-api-shell"
            echo ""
          '';
        };
      }
    );
}
