// BookNft.tact
// Простая NFT-книга: хранит владельца, ID токена, ID книги и URI с контентом.

message Transfer {
    newOwner: Address;
}

contract BookNft {

// ------- хранилище -------

    owner: Address;        // текущий владелец NFT-книги
    collection: Address;   // адрес минтера / коллекции
    bookId: Int as uint32;

// ------- инициализация -------

    init(
    owner: Address,
    collection: Address,
    bookId: Int,
    ) {
        self.owner = owner;
        self.collection = collection;
        self.tokenId = tokenId;
        self.bookId = bookId;
    }

// ------- геттеры -------

// кто владеет NFT-книгой
    get fun owner_address(): Address {
        return self.owner;
    }

// основная информация о книге

    get fun book_id(): Int {
        // (tokenId, bookId, collection, contentUri)
        return self.bookId;
    }
// ------- transfer -------

    // простой трансфер без хуков и роялти
    receive(msg: Transfer) {
        require(sender() == self.owner, "NOT_OWNER");
        self.owner = msg.newOwner;
    }
}
