// BookNftMinter.tact
import "@stdlib/ownable";

import "./BookNft.tact";

// Сообщение, которое ты будешь отправлять с сервера
// для минта книги конкретному пользователю.
message MintBook {
    buyer: Address;        // кому выдать NFT
    bookId: Int as uint32; // внутренний ID книги
    contentUri: String;    // URI метаданных / файла книги
}

contract BookNftMinter with Ownable {

// Ownable требует это поле
    owner: Address;

// Счётчик токенов (каждая покупка = новый tokenId)
    nextTokenId: Int as uint64;

// Инициализация: передаёшь свой адрес (серверный кошелёк / админ)
    init(owner: Address) {
        self.owner = owner;
        self.nextTokenId = 0;
    }

// Геттер для информации
    get fun next_token_id(): Int {
        return self.nextTokenId;
    }

// ----------- mint_book -----------

// Вызывается ТОЛЬКО владельцем (owner).
//
// С сервера ты строишь тело сообщения MintBook и
// прикрепляешь немного TON для деплоя NFT.
//
// Все прикреплённые TON уходят на новый NFT-контракт,
// чтобы он мог оплачивать хранение и gas.
    receive(msg: MintBook) {
        // ограничиваем доступ
        self.requireOwner();

        // следующий ID токена
        let tokenId = self.nextTokenId;
        self.nextTokenId += 1;

        // сколько TON пришло с этим вызовом (для деплоя NFT)
        let value = context().value;

        // деплой новой NFT-книги
        deploy BookNft(
        owner: msg.buyer,
        collection: myAddress(),
        tokenId: tokenId,
        bookId: msg.bookId,
        contentUri: msg.contentUri
        ) with {
        value: value,  // всё прикреплённое значение идёт на баланс NFT
        bounce: false
        };
}
}
