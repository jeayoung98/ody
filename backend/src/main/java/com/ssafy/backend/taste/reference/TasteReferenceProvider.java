package com.ssafy.backend.taste.reference;

import java.util.Optional;

public interface TasteReferenceProvider {

    Optional<TasteReference> current();
}
