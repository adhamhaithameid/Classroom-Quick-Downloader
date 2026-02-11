package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

var errTrailingJSON = errors.New("trailing JSON data")

func decodeJSONBodyStrict(r *http.Request, dst any) error {
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
