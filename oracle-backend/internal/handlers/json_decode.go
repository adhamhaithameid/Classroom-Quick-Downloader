package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

var errTrailingJSON = errors.New("trailing JSON data")

func DecodeJSONBodyStrict(r *http.Request, dst any) error {
	// Limit request body to 1MB to prevent memory exhaustion DoS attacks
	r.Body = http.MaxBytesReader(nil, r.Body, 1<<20)

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		if err == nil {
			return errTrailingJSON
		}
		return err
	}
	return nil
}

func decodeJSONBodyStrict(r *http.Request, dst any) error {
	return DecodeJSONBodyStrict(r, dst)
}
