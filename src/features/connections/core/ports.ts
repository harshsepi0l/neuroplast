/** Persistence contracts owned by the connections domain. */


export interface AuthStore {
	/** The whole map — absent or corrupt file = {} ("no keys yet", the
	 *  documented first-boot state). Never throws. */
	authVars(): Record<string, string>;
	/** Set one VAR (atomic write, mode 0600 always, other vars preserved). */
	setAuthVar(name: string, value: string): void;
	/** Remove one VAR if present (absent = no-op, still a silent success). */
	deleteAuthVar(name: string): void;
}
