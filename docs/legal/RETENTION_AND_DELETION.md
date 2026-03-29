# Retention and Deletion

## Intended retention model

QuietClaw is designed to expire certain local working data after approximately 24 hours.

This is a retention target, not a guarantee. Copies may persist longer because of logs, caches, crash files, backups, hibernation, operating-system behavior, sync delays, or software error.

## Manual clear action

QuietClaw provides a manual "clear local data" action in settings so you can remove application data without waiting for the target retention window.

## Data that may outlive the target window

Some classes of data may remain longer than the intended window, including:

- local caches;
- logs;
- crash files;
- backups;
- operating-system level artifacts and behavior;
- delayed deletion caused by device state or software error.

## What "clear local data" does

The manual clear action is intended to remove QuietClaw-managed local application data from this device and return the app to a first-launch state.

## What "clear local data" does not remove

The manual clear action does not guarantee removal of data copies that may exist in operating-system caches, filesystem snapshots, backups, synced folders, crash artifacts, debugging captures, or other storage layers outside QuietClaw's direct control.
