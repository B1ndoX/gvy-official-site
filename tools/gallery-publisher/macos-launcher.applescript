on run
    set anchorPath to POSIX path of (path to me)
    set locatorScript to "PUBLISHER_CURSOR=" & quoted form of anchorPath & "; PUBLISHER_CURSOR=${PUBLISHER_CURSOR:A}; if [[ -f \"$PUBLISHER_CURSOR\" ]]; then PUBLISHER_CURSOR=${PUBLISHER_CURSOR:h}; fi; while [[ \"$PUBLISHER_CURSOR\" != \"/\" ]]; do PUBLISHER_LAUNCHER=\"$PUBLISHER_CURSOR/tools/gallery-publisher/launch-macos.zsh\"; if [[ -f \"$PUBLISHER_LAUNCHER\" ]]; then print -r -- \"$PUBLISHER_LAUNCHER\"; exit 0; fi; PUBLISHER_CURSOR=${PUBLISHER_CURSOR:h}; done; exit 1"
    set launchScript to do shell script "/bin/zsh -c " & quoted form of locatorScript

    with timeout of 86400 seconds
        do shell script "/bin/zsh " & quoted form of launchScript
    end timeout

    quit
end run
