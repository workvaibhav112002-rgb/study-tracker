// Package brand holds the product name in one place. Renaming the product is
// a change here (and in frontend/src/lib/brand.ts); internal identifiers such
// as the JWT issuer and calendar UIDs deliberately keep the original id.
package brand

const (
	// Name is shown in emails, the calendar feed and download filenames.
	Name = "Granule"
	// FilePrefix starts every exported filename.
	FilePrefix = "granule"
)
